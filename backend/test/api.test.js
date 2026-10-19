import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestDb } from "../test-support/db.js";

// Haqiqiy PostgreSQL ustida to‘liq API sinovi (TEST_DATABASE_URL yoki vaqtinchalik embedded-postgres).
let db, server, base, arrangeOptions, loc;
let n = 0;

before(async () => {
  db = await startTestDb();
  ({ arrangeOptions } = await import("../src/quizEngine.js"));
  ({ loc } = await import("../src/store.js"));
  const { default: app } = await import("../src/server.js");
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  server?.close();
  await db?.stop();
});

async function call(method, path, { token, body, child } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(child ? { "X-Child-Id": child } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function signup(prefix = "user") {
  const email = `${prefix}${++n}@example.com`;
  const r = await call("POST", "/api/auth/register", { body: { name: "Ali", email, password: "secret123" } });
  assert.equal(r.status, 201);
  const token = r.body.token;
  await call("PATCH", "/api/me", { token, body: { grade: 1, subject: "mathematics", mascot: "pandacha" } });
  return { token, email, user: r.body.user };
}

/** Berilgan savol uchun to‘g‘ri variant indeksini bazadan aniqlaydi (testda mijoz bilmaydi). */
async function correctIndexFor(sessionId, question) {
  const { rows } = await db.pool.query("SELECT * FROM questions WHERE id = $1", [question.id]);
  return arrangeOptions(sessionId, question.id, loc(rows[0].options, "uz"), rows[0].correct_index).correctIndex;
}

/** Testni oxirigacha yechadi; mistakes[i] true bo‘lsa i-savolga ataylab xato javob beradi. */
async function playAll(token, session, { wrongAt = [], child } = {}) {
  let q = session.question;
  let i = session.index;
  const difficulties = [];
  const ids = [];
  while (q) {
    const right = await correctIndexFor(session.sessionId, q);
    const answer = wrongAt.includes(i) ? (right + 1) % q.options.length : right;
    difficulties.push(q.difficulty);
    ids.push(q.id);
    const r = await call("POST", `/api/quiz/${session.sessionId}/answer`, { token, child, body: { index: i, answer } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    q = r.body.next;
    i++;
  }
  return { difficulties, ids };
}

const start = (token, body = { grade: 1, subject: "mathematics" }, child) => call("POST", "/api/quiz/start", { token, body, child });

test("ro‘yxatdan o‘tish, kirish va autentifikatsiya tekshiruvi", async () => {
  const { email } = await signup("auth");
  assert.equal((await call("POST", "/api/auth/register", { body: { name: "Ali", email, password: "secret123" } })).status, 409);
  assert.equal((await call("POST", "/api/auth/register", { body: { name: "A", email: "x@y.com", password: "123" } })).status, 400);
  assert.equal((await call("POST", "/api/auth/login", { body: { email, password: "wrongpass" } })).status, 401);
  const ok = await call("POST", "/api/auth/login", { body: { email: email.toUpperCase(), password: "secret123" } });
  assert.equal(ok.status, 200);
  assert.equal((await call("GET", "/api/me")).status, 401);
  assert.equal((await call("GET", "/api/me", { token: "garbage" })).status, 401);
  const me = await call("GET", "/api/me", { token: ok.body.token });
  assert.equal(me.body.user.email, email);
  assert.equal(me.body.user.child.level, 1);
});

test("JWT_SECRET yo‘q bo‘lsa — aniq sozlash xatosi, tasodifiy kalit yaratilmaydi", async () => {
  const { token } = await signup("cfg");
  const saved = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    const r = await call("GET", "/api/me", { token });
    assert.equal(r.status, 500);
    assert.match(r.body.error, /JWT_SECRET/);
  } finally {
    process.env.JWT_SECRET = saved;
  }
  assert.equal((await call("GET", "/api/me", { token })).status, 200);
});

test("token_version oshirilsa eski tokenlar bekor bo‘ladi", async () => {
  const { token, email } = await signup("tv");
  await db.pool.query("UPDATE users SET token_version = token_version + 1 WHERE email = $1", [email]);
  assert.equal((await call("GET", "/api/me", { token })).status, 401);
});

test("test: oson->qiyin tartib, takrorlanmas savollar, javoblar saqlanadi, yakun natija beradi", async () => {
  const { token } = await signup("quiz");
  const s = (await start(token)).body;
  assert.equal(s.total, 20);
  assert.equal(s.index, 0);
  assert.equal(s.resumed, false);
  assert.ok(!("correctIndex" in s.question) && !("correct_index" in s.question), "to‘g‘ri javob mijozga yuborilmasligi kerak");

  const { difficulties, ids } = await playAll(token, s);
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids).size, 20, "takroriy savol bo‘lmasligi kerak");
  assert.equal(difficulties[0], "easy");
  assert.equal(difficulties.at(-1), "hard");
  const order = { easy: 1, medium: 2, hard: 3 };
  for (let i = 1; i < difficulties.length; i++) assert.ok(order[difficulties[i]] >= order[difficulties[i - 1]], `qiyinlik pasaymasligi kerak: ${difficulties}`);

  const fin = await call("POST", `/api/quiz/${s.sessionId}/finish`, { token });
  assert.equal(fin.status, 200);
  assert.equal(fin.body.result.correct, 20);
  assert.equal(fin.body.result.score, 200);
  assert.equal(fin.body.result.answers.length, 20);
  assert.ok(fin.body.newAchievements.some((a) => a.id === "first"));
  assert.ok(fin.body.newAchievements.some((a) => a.id === "perfect"));

  const me = (await call("GET", "/api/me", { token })).body.user.child;
  assert.equal(me.xp, 210);
  assert.equal(me.balance, 200 + 20 + 100 + 50, "test balli + 'Birinchi qadam', 'Mukammal', 'To‘xtatib bo‘lmas' mukofotlari");
  const got = await call("GET", `/api/results/${fin.body.result.id}`, { token });
  assert.equal(got.body.result.correct, 20);
});

test("sahifa yangilanganda sessiya tiklanadi (holat bazada, xotirada emas)", async () => {
  const { token } = await signup("resume");
  const s = (await start(token)).body;
  // 5 ta javob beramiz
  let q = s.question;
  for (let i = 0; i < 5; i++) {
    const r = await call("POST", `/api/quiz/${s.sessionId}/answer`, { token, body: { index: i, answer: await correctIndexFor(s.sessionId, q) } });
    q = r.body.next;
  }
  const again = (await start(token)).body;
  assert.equal(again.sessionId, s.sessionId);
  assert.equal(again.resumed, true);
  assert.equal(again.index, 5);
  assert.equal(again.question.id, q.id);
  assert.deepEqual(again.question.options, q.options, "variantlar tartibi o‘zgarmasligi kerak");
  assert.equal(again.state.correct, 5);
  const active = await call("GET", "/api/quiz/active?grade=1&subject=mathematics", { token });
  assert.equal(active.body.session.sessionId, s.sessionId);
});

test("takroriy javob yuborilsa saqlangan natija qaytadi va hech narsa ikki marta hisoblanmaydi", async () => {
  const { token } = await signup("dup");
  const s = (await start(token)).body;
  const answer = await correctIndexFor(s.sessionId, s.question);
  const a = await call("POST", `/api/quiz/${s.sessionId}/answer`, { token, body: { index: 0, answer } });
  const b = await call("POST", `/api/quiz/${s.sessionId}/answer`, { token, body: { index: 0, answer: (answer + 1) % 4 } });
  assert.equal(b.status, 200);
  assert.equal(b.body.replayed, true);
  assert.equal(b.body.correct, true, "dastlabki javob o‘zgarmaydi");
  assert.equal(b.body.state.correct, 1);
  assert.deepEqual(a.body.state, b.body.state);
  assert.equal((await call("POST", `/api/quiz/${s.sessionId}/answer`, { token, body: { index: 5, answer: 0 } })).status, 409, "tartibsiz javob rad etiladi");
  assert.equal((await call("POST", `/api/quiz/${s.sessionId}/answer`, { token, body: { index: 1, answer: 99 } })).status, 400);
  assert.equal((await call("POST", `/api/quiz/${s.sessionId}/finish`, { token })).status, 409, "tugamagan testni yakunlab bo‘lmaydi");
});

test("parallel so‘rovlar: bir xil javob ham, ko‘p marta 'finish' ham faqat bir marta hisoblanadi", async () => {
  const { token } = await signup("race");
  const s = (await start(token)).body;
  const right = await correctIndexFor(s.sessionId, s.question);
  const rs = await Promise.all(Array.from({ length: 6 }, () => call("POST", `/api/quiz/${s.sessionId}/answer`, { token, body: { index: 0, answer: right } })));
  assert.ok(rs.every((r) => r.status === 200));
  const { rows } = await db.pool.query("SELECT count(*)::int n FROM quiz_answers WHERE session_id = $1", [s.sessionId]);
  assert.equal(rows[0].n, 1);

  // qolganini yechamiz
  let q = rs.find((r) => r.body.next).body.next;
  let i = 1;
  while (q) {
    const r = await call("POST", `/api/quiz/${s.sessionId}/answer`, { token, body: { index: i++, answer: await correctIndexFor(s.sessionId, q) } });
    q = r.body.next;
  }
  const fins = await Promise.all(Array.from({ length: 6 }, () => call("POST", `/api/quiz/${s.sessionId}/finish`, { token })));
  assert.ok(fins.every((r) => r.status === 200), JSON.stringify(fins.map((f) => f.status)));
  assert.equal(new Set(fins.map((f) => f.body.result.id)).size, 1);
  const { rows: led } = await db.pool.query("SELECT count(*)::int n, sum(points)::int p FROM point_ledger WHERE reason = 'quiz' AND ref_id = $1", [fins[0].body.result.id]);
  assert.equal(led[0].n, 1);
  assert.equal(led[0].p, 200);
  const { rows: res } = await db.pool.query("SELECT count(*)::int n FROM results WHERE session_id = $1", [s.sessionId]);
  assert.equal(res[0].n, 1);
});

test("moslashuv: qator xatolardan keyin savollar osonlashadi, qator to‘g‘rilardan keyin qiyinlashadi", async () => {
  const { token } = await signup("adapt");
  const s = (await start(token, { grade: 3, subject: "mathematics" })).body;
  // 8–13-savollar (o‘rta daraja) ataylab xato: 2 ta xatodan keyin siljish -1
  const { difficulties } = await playAll(token, s, { wrongAt: [7, 8, 9, 10, 11, 12] });
  const order = { easy: 1, medium: 2, hard: 3 };
  assert.equal(difficulties[3], "medium", `3 ta ketma-ket to‘g‘ridan keyin qiyinroq: ${difficulties}`);
  assert.equal(difficulties[8], "hard");
  assert.ok(order[difficulties[9]] < order[difficulties[8]], `2 ta ketma-ket xatodan keyin osonroq: ${difficulties}`);
  assert.equal(difficulties[11], "easy", `xatolar davom etsa yana osonlashadi: ${difficulties}`);
  const fin = await call("POST", `/api/quiz/${s.sessionId}/finish`, { token });
  assert.equal(fin.status, 200);
  assert.equal(fin.body.result.incorrect, 6);
});

test("'Xatolar ustida ishlash': xato savollar qaytadi, 3 ta ketma-ket to‘g‘ri javobdan keyin o‘zlashtiriladi", async () => {
  const { token } = await signup("mist");
  assert.equal((await start(token, { grade: 1, subject: "mathematics", mode: "mistakes" })).status, 409, "xato yo‘q bo‘lsa");
  const s = (await start(token)).body;
  const { ids } = await playAll(token, s, { wrongAt: [0] });
  assert.equal((await call("POST", `/api/quiz/${s.sessionId}/finish`, { token })).status, 200);

  for (let round = 1; round <= 3; round++) {
    const m = await start(token, { grade: 1, subject: "mathematics", mode: "mistakes" });
    assert.equal(m.status, 200, `${round}-raund: ${JSON.stringify(m.body)}`);
    assert.equal(m.body.total, 1);
    assert.equal(m.body.question.id, ids[0]);
    const r = await call("POST", `/api/quiz/${m.body.sessionId}/answer`, { token, body: { index: 0, answer: await correctIndexFor(m.body.sessionId, m.body.question) } });
    assert.equal(r.body.correct, true);
    assert.ok(r.body.explanation);
    const fin = await call("POST", `/api/quiz/${m.body.sessionId}/finish`, { token });
    assert.equal(fin.body.result.mode, "mistakes");
    assert.equal(fin.body.result.score, 5);
    if (round < 3) {
      const { rows } = await db.pool.query("SELECT mastered, correct_streak FROM question_stats WHERE question_id = $1 AND wrong_count > 0 ORDER BY last_answered_at DESC LIMIT 1", [ids[0]]);
      assert.equal(rows[0].mastered, false, "bitta to‘g‘ri javob xatoni o‘chirmaydi");
    }
  }
  assert.equal((await start(token, { grade: 1, subject: "mathematics", mode: "mistakes" })).status, 409, "o‘zlashtirilgandan keyin ro‘yxat bo‘sh");
});

test("kunlik seriya: bir kunda ikki test seriyani oshirmaydi", async () => {
  const { token } = await signup("streak");
  for (let k = 0; k < 2; k++) {
    const s = (await start(token)).body;
    await playAll(token, s);
    assert.equal((await call("POST", `/api/quiz/${s.sessionId}/finish`, { token })).status, 200);
  }
  const p = (await call("GET", "/api/progress", { token })).body;
  assert.equal(p.streak, 1);
  assert.equal(p.quizzes, 2);
  assert.equal(p.dailyGoal.met, true);
  assert.equal(p.dailyGoal.done, 2);
  // ertasi kuni -> 2, ikki kunlik tanaffus -> 1
  await db.pool.query("UPDATE children SET last_active_day = (now()::date - 1) WHERE parent_id = (SELECT user_id FROM (SELECT $1::uuid AS user_id) t)", [(await call("GET", "/api/me", { token })).body.user.id]);
  const s = (await start(token)).body;
  await playAll(token, s);
  const fin = await call("POST", `/api/quiz/${s.sessionId}/finish`, { token });
  assert.equal(fin.body.streak, 2);
});

test("muddati o‘tgan sessiya: javob 410, yangi test boshlash mumkin", async () => {
  const { token } = await signup("exp");
  const s = (await start(token)).body;
  await db.pool.query("UPDATE quiz_sessions SET expires_at = now() - interval '1 minute' WHERE id = $1", [s.sessionId]);
  const r = await call("POST", `/api/quiz/${s.sessionId}/answer`, { token, body: { index: 0, answer: 0 } });
  assert.equal(r.status, 410);
  const fresh = (await start(token)).body;
  assert.notEqual(fresh.sessionId, s.sessionId);
  assert.equal(fresh.resumed, false);
});

test("kirish nazorati: boshqa foydalanuvchi sessiya, natija va bola profiliga kira olmaydi", async () => {
  const a = await signup("owner");
  const b = await signup("intruder");
  const s = (await start(a.token)).body;
  assert.equal((await call("POST", `/api/quiz/${s.sessionId}/answer`, { token: b.token, body: { index: 0, answer: 0 } })).status, 404);
  assert.equal((await call("POST", `/api/quiz/${s.sessionId}/finish`, { token: b.token })).status, 404);
  assert.equal((await call("POST", `/api/quiz/not-a-uuid/finish`, { token: b.token })).status, 404);

  const done = (await start(a.token, { grade: 2, subject: "mathematics" })).body;
  await playAll(a.token, done);
  const fin = await call("POST", `/api/quiz/${done.sessionId}/finish`, { token: a.token });
  assert.equal((await call("GET", `/api/results/${fin.body.result.id}`, { token: b.token })).status, 404);

  const aChild = (await call("GET", "/api/children", { token: a.token })).body.activeId;
  assert.equal((await call("GET", "/api/me", { token: b.token, child: aChild })).status, 404, "boshqa ota-onaning bolasi ID si bilan kirib bo‘lmaydi");
  assert.equal((await call("GET", "/api/progress", { token: b.token, child: aChild })).status, 404);
});

test("bir nechta bola: ma‘lumotlar aralashmaydi", async () => {
  const { token } = await signup("kids");
  const kids = (await call("GET", "/api/children", { token })).body;
  const first = kids.activeId;
  const created = await call("POST", "/api/children", { token, body: { name: "Madina", grade: 2 } });
  assert.equal(created.status, 201);
  const second = created.body.child.id;

  const s = (await start(token, { grade: 1, subject: "mathematics" }, first)).body;
  await playAll(token, s, { child: first });
  assert.equal((await call("POST", `/api/quiz/${s.sessionId}/finish`, { token, child: first })).status, 200);

  const p1 = (await call("GET", "/api/progress", { token, child: first })).body;
  const p2 = (await call("GET", "/api/progress", { token, child: second })).body;
  assert.equal(p1.quizzes, 1);
  assert.equal(p2.quizzes, 0);
  assert.equal(p2.balance, 0);
  assert.equal(p2.streak, 0);
  // ikkinchi bola birinchisining sessiyasiga kira olmaydi
  assert.equal((await call("POST", `/api/quiz/${s.sessionId}/finish`, { token, child: second })).status, 404);

  assert.equal((await call("PATCH", "/api/me", { token, child: second, body: { subject: "english", locale: "ru", soundEnabled: false } })).status, 200);
  const me2 = (await call("GET", "/api/me", { token, child: second })).body.user;
  assert.equal(me2.profile.subject, "english");
  assert.equal(me2.child.locale, "ru");
  assert.equal(me2.child.soundEnabled, false);
  const me1 = (await call("GET", "/api/me", { token, child: first })).body.user;
  assert.equal(me1.child.soundEnabled, true, "sozlamalar bolalar bo‘yicha alohida");
});

test("noto‘g‘ri kirishlar rad etiladi", async () => {
  const { token } = await signup("bad");
  assert.equal((await start(token, { grade: 9, subject: "mathematics" })).status, 400);
  assert.equal((await start(token, { grade: 1, subject: "nope" })).status, 400);
  assert.equal((await call("PATCH", "/api/me", { token, body: { timezone: "Not/AZone" } })).status, 400);
  assert.equal((await call("GET", "/api/health")).status, 200);
});
