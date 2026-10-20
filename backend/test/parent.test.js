import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { boot } from "../test-support/api.js";

let t;
let outbox;
before(async () => {
  t = await boot();
  ({ testOutbox: outbox } = await import("../src/mailer.js"));
});
after(async () => {
  await t?.stop();
});

test("rozilik: ro‘yxatdan o‘tishda majburiy, bo‘lmasa testni boshlab bo‘lmaydi", async () => {
  const noConsent = await t.call("POST", "/api/auth/register", { body: { name: "Ali", email: "nc1@example.com", password: "secret123" } });
  assert.equal(noConsent.status, 400);
  assert.match(noConsent.body.error, /rozilik/i);

  const { token, user } = await t.signup("cons");
  assert.equal(user.needsConsent, false);
  const { rows } = await t.db.pool.query("SELECT version FROM parental_consents WHERE user_id = $1", [user.id]);
  assert.equal(rows.length, 1);

  // eski akkaunt (rozilik yozuvi yo‘q) — roziligini bergunicha ishlay olmaydi
  await t.db.pool.query("DELETE FROM parental_consents WHERE user_id = $1", [user.id]);
  assert.equal((await t.call("GET", "/api/me", { token })).body.user.needsConsent, true);
  assert.equal((await t.start(token)).status, 409);
  assert.equal((await t.call("POST", "/api/consent", { token, body: { accept: false } })).status, 400);
  const ok = await t.call("POST", "/api/consent", { token, body: { accept: true } });
  assert.equal(ok.body.user.needsConsent, false);
  assert.equal((await t.start(token)).status, 200);
});

test("ota-ona PIN: o‘rnatish parol talab qiladi, noto‘g‘ri PIN rad etiladi va cheklanadi, token boshqa akkauntga yaramaydi", async () => {
  const a = await t.signup("pin");
  assert.equal((await t.call("GET", "/api/parent/status", { token: a.token })).body.hasPin, false);
  assert.equal((await t.call("POST", "/api/parent/verify", { token: a.token, body: { pin: "1234" } })).status, 409, "PIN o‘rnatilmagan");
  assert.equal((await t.call("POST", "/api/parent/pin", { token: a.token, body: { pin: "1234", password: "wrong-pass" } })).status, 401);
  assert.equal((await t.call("POST", "/api/parent/pin", { token: a.token, body: { pin: "12", password: "secret123" } })).status, 400);
  assert.equal((await t.call("POST", "/api/parent/pin", { token: a.token, body: { pin: "4821", password: "secret123" } })).status, 200);
  assert.equal((await t.call("GET", "/api/parent/status", { token: a.token })).body.hasPin, true);

  assert.equal((await t.call("GET", "/api/parent/overview", { token: a.token })).status, 403, "PIN-kodsiz kirib bo‘lmaydi");
  assert.equal((await t.call("POST", "/api/parent/verify", { token: a.token, body: { pin: "0000" } })).status, 401);
  const good = await t.call("POST", "/api/parent/verify", { token: a.token, body: { pin: "4821" } });
  assert.equal(good.status, 200);
  assert.equal((await t.call("GET", "/api/parent/overview", { token: a.token, parent: good.body.parentToken })).status, 200);

  const b = await t.signup("pin2");
  assert.equal((await t.call("GET", "/api/parent/overview", { token: b.token, parent: good.body.parentToken })).status, 403, "boshqa ota-onaning tokeni yaramaydi");
  assert.equal((await t.call("GET", "/api/parent/overview", { token: a.token, parent: "garbage" })).status, 403);

  // 5 ta noto‘g‘ri urinishdan keyin bloklanadi
  const c = await t.signup("pin3");
  await t.parentToken(c.token, "1111");
  for (let i = 0; i < 5; i++) assert.equal((await t.call("POST", "/api/parent/verify", { token: c.token, body: { pin: "9999" } })).status, 401);
  assert.equal((await t.call("POST", "/api/parent/verify", { token: c.token, body: { pin: "1111" } })).status, 429, "to‘g‘ri PIN ham vaqtincha bloklanadi");
});

test("ota-ona statistikasi: tarix, ishonchlilik belgisi, faqat o‘z bolalari", async () => {
  const a = await t.signup("stat");
  const parent = await t.parentToken(a.token);
  const s = (await t.start(a.token, { grade: 1, subject: "mathematics", testId: "level-1" })).body;
  await t.playAll(a.token, s, { wrongAt: [0, 1] });
  await t.finish(a.token, s);

  const o = (await t.call("GET", "/api/parent/overview", { token: a.token, parent })).body;
  assert.equal(o.child.name, "Ali");
  assert.equal(o.history.length, 1);
  assert.equal(o.history[0].accuracy, 80);
  assert.equal(o.history[0].title, "1-bosqich · Boshlang‘ich");
  assert.deepEqual(o.trend, [80]);
  assert.equal(o.totals.tests, 1);
  assert.equal(o.bySubject.length, 1);
  assert.equal(o.bySubject[0].reliable, false, "bitta urinish bilimni baholamaydi");
  assert.ok(o.notes.length >= 1);
  assert.ok(o.totals.minutes >= 0);

  // boshqa ota-onaning bolasi ID si bilan so‘rash
  const b = await t.signup("stat2");
  const bParent = await t.parentToken(b.token);
  const bChild = (await t.call("GET", "/api/children", { token: b.token })).body.activeId;
  assert.equal((await t.call("GET", `/api/parent/overview?child=${bChild}`, { token: a.token, parent })).status, 404);
  assert.equal((await t.call("GET", `/api/parent/overview?child=${bChild}`, { token: b.token, parent: bParent })).status, 200);
});

test("bola profili o‘chirish: ism tasdiqlanadi, oxirgisi o‘chmaydi, ma’lumotlari ham o‘chadi", async () => {
  const a = await t.signup("del");
  const parent = await t.parentToken(a.token);
  const kid = await t.call("POST", "/api/children", { token: a.token, parent, body: { name: "Madina", grade: 2 } });
  assert.equal(kid.status, 201);
  const kidId = kid.body.child.id;
  const s = (await t.start(a.token, { grade: 1, subject: "mathematics", testId: "level-1" }, kidId)).body;
  await t.playAll(a.token, s, { child: kidId });
  await t.finish(a.token, s, { child: kidId });

  assert.equal((await t.call("DELETE", `/api/parent/children/${kidId}`, { token: a.token })).status, 403, "PIN-kodsiz");
  assert.equal((await t.call("DELETE", `/api/parent/children/${kidId}`, { token: a.token, parent, body: { confirmName: "boshqa" } })).status, 400);
  assert.equal((await t.call("DELETE", `/api/parent/children/${kidId}`, { token: a.token, parent, body: { confirmName: "madina" } })).status, 200);
  const { rows } = await t.db.pool.query("SELECT (SELECT count(*) FROM results WHERE child_id = $1)::int AS r, (SELECT count(*) FROM quiz_sessions WHERE child_id = $1)::int AS s", [kidId]);
  assert.deepEqual(rows[0], { r: 0, s: 0 });
  const first = (await t.call("GET", "/api/children", { token: a.token })).body.activeId;
  assert.equal((await t.call("DELETE", `/api/parent/children/${first}`, { token: a.token, parent, body: { confirmName: "ali" } })).status, 409, "oxirgi profil");
});

test("akkauntni o‘chirish: parol va email tasdiqlanadi, hamma ma’lumot o‘chadi, token yaroqsiz bo‘ladi", async () => {
  const a = await t.signup("kill");
  const parent = await t.parentToken(a.token);
  const s = (await t.start(a.token, { grade: 1, subject: "mathematics", testId: "level-1" })).body;
  await t.playAll(a.token, s);
  await t.finish(a.token, s);
  const userId = a.user.id;

  assert.equal((await t.call("DELETE", "/api/parent/account", { token: a.token, body: { password: "secret123", confirm: a.email } })).status, 403, "PIN-kodsiz");
  assert.equal((await t.call("DELETE", "/api/parent/account", { token: a.token, parent, body: { password: "wrong", confirm: a.email } })).status, 401);
  assert.equal((await t.call("DELETE", "/api/parent/account", { token: a.token, parent, body: { password: "secret123", confirm: "x@y.com" } })).status, 400);
  assert.equal((await t.call("DELETE", "/api/parent/account", { token: a.token, parent, body: { password: "secret123", confirm: a.email.toUpperCase() } })).status, 200);

  const { rows } = await t.db.pool.query(
    "SELECT (SELECT count(*) FROM users WHERE id = $1)::int AS u, (SELECT count(*) FROM children WHERE parent_id = $1)::int AS c, (SELECT count(*) FROM results r JOIN children c ON c.id = r.child_id WHERE c.parent_id = $1)::int AS r",
    [userId],
  );
  assert.deepEqual(rows[0], { u: 0, c: 0, r: 0 });
  assert.equal((await t.call("GET", "/api/me", { token: a.token })).status, 401);
  assert.equal((await t.call("POST", "/api/auth/login", { body: { email: a.email, password: "secret123" } })).status, 401);
});

test("parolni tiklash: haqiqiy xat, bir martalik muddatli token, hisob mavjudligi oshkor qilinmaydi", async () => {
  const a = await t.signup("reset");
  const before = outbox().length;

  const known = await t.call("POST", "/api/auth/forgot", { body: { email: a.email } });
  const unknown = await t.call("POST", "/api/auth/forgot", { body: { email: "nobody-here@example.com" } });
  assert.equal(known.status, 200);
  assert.deepEqual(known.body, unknown.body, "javoblar bir xil bo‘lishi kerak");
  assert.equal(outbox().length, before + 1, "faqat mavjud hisobga xat yuboriladi");

  const mail = outbox().at(-1);
  assert.equal(mail.to, a.email);
  const token = mail.text.match(/token=([0-9a-f]{64})/)[1];
  const { rows } = await t.db.pool.query("SELECT token_hash FROM password_reset_tokens WHERE user_id = $1", [a.user.id]);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].token_hash, token, "token bazada ochiq holda saqlanmaydi");
  assert.equal(rows[0].token_hash.length, 64);

  assert.equal((await t.call("POST", "/api/auth/reset", { body: { token: "a".repeat(64), password: "newpass123" } })).status, 400, "noto‘g‘ri token");
  assert.equal((await t.call("POST", "/api/auth/reset", { body: { token, password: "123" } })).status, 400, "qisqa parol");
  assert.equal((await t.call("POST", "/api/auth/reset", { body: { token, password: "newpass123" } })).status, 200);
  assert.equal((await t.call("POST", "/api/auth/reset", { body: { token, password: "another123" } })).status, 400, "token qayta ishlatilmaydi");

  assert.equal((await t.call("POST", "/api/auth/login", { body: { email: a.email, password: "secret123" } })).status, 401, "eski parol ishlamaydi");
  assert.equal((await t.call("POST", "/api/auth/login", { body: { email: a.email, password: "newpass123" } })).status, 200);
  assert.equal((await t.call("GET", "/api/me", { token: a.token })).status, 401, "eski sessiyalar bekor qilinadi");

  // muddati o‘tgan token
  await t.call("POST", "/api/auth/forgot", { body: { email: a.email } });
  const t2 = outbox().at(-1).text.match(/token=([0-9a-f]{64})/)[1];
  await t.db.pool.query("UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = $1", [a.user.id]);
  assert.equal((await t.call("POST", "/api/auth/reset", { body: { token: t2, password: "latest123" } })).status, 400);
});

test("email sozlanmagan bo‘lsa — soxta muvaffaqiyat emas, aniq 503", async () => {
  const saved = process.env.MAIL_TRANSPORT;
  delete process.env.MAIL_TRANSPORT;
  try {
    const r = await t.call("POST", "/api/auth/forgot", { body: { email: "anyone@example.com" } });
    assert.equal(r.status, 503);
    assert.match(r.body.error, /sozlanmagan/);
  } finally {
    process.env.MAIL_TRANSPORT = saved;
  }
});

test("kirish urinishlari bazada cheklanadi va muvaffaqiyatdan keyin tiklanadi", async () => {
  const a = await t.signup("brute");
  for (let i = 0; i < 10; i++) assert.equal((await t.call("POST", "/api/auth/login", { body: { email: a.email, password: "bad-password" } })).status, 401);
  assert.equal((await t.call("POST", "/api/auth/login", { body: { email: a.email, password: "secret123" } })).status, 429, "11-urinish bloklanadi");
  const { rows } = await t.db.pool.query("SELECT count FROM rate_limits WHERE key = $1", [`login:email:${a.email}`]);
  assert.equal(rows[0].count, 11, "hisoblagich bazada saqlanadi");

  const b = await t.signup("brute2");
  for (let i = 0; i < 3; i++) await t.call("POST", "/api/auth/login", { body: { email: b.email, password: "bad-password" } });
  assert.equal((await t.call("POST", "/api/auth/login", { body: { email: b.email, password: "secret123" } })).status, 200);
  const { rowCount } = await t.db.pool.query("SELECT 1 FROM rate_limits WHERE key = $1", [`login:email:${b.email}`]);
  assert.equal(rowCount, 0, "muvaffaqiyatli kirishdan keyin hisoblagich tozalanadi");
});
