import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { boot } from "../test-support/api.js";

let t;
before(async () => {
  t = await boot();
});
after(async () => {
  await t?.stop();
});

/** Bitta aralash testni yechib, 370 ball (200 + yutuqlar) va 3-daraja oladi. */
async function earnPoints(token) {
  const s = (await t.start(token, { grade: 1, subject: "mathematics", testId: "mixed" })).body;
  await t.playAll(token, s);
  await t.finish(token, s);
  return (await t.call("GET", "/api/me", { token })).body.user.child;
}

test("do‘kon: ball yetmasa rad, xarid atomik, takroriy va parallel xaridlar balansni buzmaydi", async () => {
  const { token } = await t.signup("shop");
  const empty = (await t.call("GET", "/api/shop", { token })).body;
  assert.equal(empty.balance, 0);
  assert.equal(empty.items.length, 6);
  assert.equal((await t.call("POST", "/api/shop/cap/buy", { token })).status, 409, "ball yetarli emas");

  const me = await earnPoints(token);
  assert.equal(me.balance, 370);
  assert.equal(me.level, 3);

  const buy = await t.call("POST", "/api/shop/cap/buy", { token });
  assert.equal(buy.status, 200);
  assert.ok(buy.body.newAchievements.some((a) => a.id === "shopper"));
  assert.equal((await t.call("GET", "/api/me", { token })).body.user.child.balance, 340, "370 - 50 + 20 (Birinchi xarid yutug‘i)");
  assert.deepEqual((await t.call("GET", "/api/me", { token })).body.user.child.equipped, ["cap"]);
  assert.equal((await t.call("POST", "/api/shop/cap/buy", { token })).status, 409, "bir xil buyumni ikki marta olib bo‘lmaydi");
  assert.equal((await t.call("POST", "/api/shop/crown/buy", { token })).status, 403, "daraja yetmaydi");
  assert.equal((await t.call("POST", "/api/shop/nope/buy", { token })).status, 404);

  // parallel: 340 ball, kubok 250 — faqat bittasi o‘tadi
  const race = await Promise.all([1, 2, 3].map(() => t.call("POST", "/api/shop/trophy/buy", { token })));
  assert.equal(race.filter((r) => r.status === 200).length, 1);
  assert.equal((await t.call("GET", "/api/shop", { token })).body.balance, 90);

  // kiyish / yechish; toifa bo‘yicha bitta buyum
  assert.equal((await t.call("POST", "/api/shop/cap/equip", { token, body: { equipped: false } })).status, 200);
  assert.deepEqual((await t.call("GET", "/api/me", { token })).body.user.child.equipped, ["trophy"]);
  assert.equal((await t.call("POST", "/api/shop/glasses/equip", { token, body: { equipped: true } })).status, 404, "sotib olinmagan buyumni kiyib bo‘lmaydi");
  await t.db.pool.query("UPDATE children SET level = 4, points_balance = 500 WHERE points_balance = 90");
  assert.equal((await t.call("POST", "/api/shop/cap/equip", { token, body: { equipped: true } })).status, 200);
  assert.equal((await t.call("POST", "/api/shop/crown/buy", { token })).status, 200);
  const eq = (await t.call("GET", "/api/me", { token })).body.user.child.equipped;
  assert.ok(eq.includes("crown") && !eq.includes("cap"), `bitta bosh kiyimi: ${eq}`);
});

test("kun savoli: har kuni bitta savol, bitta urinish, ball faqat bir marta", async () => {
  const { token } = await t.signup("daily");
  const d1 = (await t.call("GET", "/api/daily", { token })).body;
  const d2 = (await t.call("GET", "/api/daily", { token })).body;
  assert.equal(d1.question.id, d2.question.id, "kun davomida savol o‘zgarmaydi");
  assert.equal(d1.answered, false);
  assert.ok(!("correctIndex" in d1.question));

  const childId = (await t.call("GET", "/api/children", { token })).body.activeId;
  const { rows } = await t.db.pool.query("SELECT * FROM questions WHERE id = $1", [d1.question.id]);
  const right = t.arrangeOptions(`daily:${childId}:${d1.day}`, rows[0].id, t.loc(rows[0].options, "uz"), rows[0].correct_index).correctIndex;
  assert.equal((await t.call("POST", "/api/daily/answer", { token, body: { answer: 99 } })).status, 400);

  const a = await t.call("POST", "/api/daily/answer", { token, body: { answer: right } });
  assert.equal(a.status, 200);
  assert.equal(a.body.result.correct, true);
  assert.equal(a.body.result.earned, 20);
  const b = await t.call("POST", "/api/daily/answer", { token, body: { answer: (right + 1) % 4 } });
  assert.equal(b.body.replayed, true);
  assert.equal(b.body.result.correct, true, "ikkinchi urinish natijani o‘zgartirmaydi");
  const me = (await t.call("GET", "/api/me", { token })).body.user.child;
  assert.equal(me.balance, 20);
  assert.equal(me.xp, 10);

  const other = await t.signup("daily2");
  const o = (await t.call("GET", "/api/daily", { token: other.token })).body;
  const oc = (await t.call("GET", "/api/children", { token: other.token })).body.activeId;
  const { rows: oq } = await t.db.pool.query("SELECT * FROM questions WHERE id = $1", [o.question.id]);
  const oright = t.arrangeOptions(`daily:${oc}:${o.day}`, oq[0].id, t.loc(oq[0].options, "uz"), oq[0].correct_index).correctIndex;
  const wrong = await t.call("POST", "/api/daily/answer", { token: other.token, body: { answer: (oright + 1) % 4 } });
  assert.equal(wrong.body.result.correct, false);
  assert.equal(wrong.body.result.earned, 0);
  assert.equal((await t.call("GET", "/api/me", { token: other.token })).body.user.child.balance, 0);
});

test("haftalik topshiriqlar: bajarilmaganini olib bo‘lmaydi, mukofot bir marta", async () => {
  const { token } = await t.signup("weekly");
  const w0 = (await t.call("GET", "/api/weekly", { token })).body;
  assert.equal(w0.tasks.length, 4);
  assert.ok(w0.tasks.every((x) => x.progress === 0 && !x.complete));
  assert.equal((await t.call("POST", "/api/weekly/tests3/claim", { token })).status, 409);
  assert.equal((await t.call("POST", "/api/weekly/nope/claim", { token })).status, 404);

  for (let i = 0; i < 3; i++) {
    const s = (await t.start(token, { grade: 1, subject: "mathematics", testId: "level-1" })).body;
    await t.playAll(token, s);
    await t.finish(token, s);
  }
  const w1 = (await t.call("GET", "/api/weekly", { token })).body;
  assert.equal(w1.tasks.find((x) => x.id === "tests3").progress, 3);
  const before = (await t.call("GET", "/api/me", { token })).body.user.child.balance;
  const claim = await t.call("POST", "/api/weekly/tests3/claim", { token });
  assert.equal(claim.status, 200);
  assert.equal(claim.body.earned, 50);
  const afterBal = (await t.call("GET", "/api/me", { token })).body.user.child.balance;
  assert.equal(afterBal - before, 50);
  assert.equal((await t.call("POST", "/api/weekly/tests3/claim", { token })).status, 409, "mukofot ikki marta olinmaydi");
  const race = await Promise.all([1, 2, 3].map(() => t.call("POST", "/api/weekly/subjects2/claim", { token })));
  assert.ok(race.every((r) => r.status === 409), "bajarilmagan topshiriq parallel so‘rovda ham berilmaydi");
});

test("qahramonlar albomi: yopiq qahramonni tanlab bo‘lmaydi, daraja ochadi", async () => {
  const { token } = await t.signup("hero");
  const h = (await t.call("GET", "/api/heroes", { token })).body;
  assert.equal(h.heroes.filter((x) => x.unlocked).length, 4, "bepul qahramonlar: ajdarcha, pandacha, mushukcha, kuchukcha");
  const lab = h.heroes.find((x) => x.id === "labubu");
  assert.equal(lab.unlocked, false);
  assert.ok(lab.requirement);
  assert.equal((await t.call("PATCH", "/api/me", { token, body: { mascot: "labubu" } })).status, 403);
  assert.equal((await t.call("PATCH", "/api/me", { token, body: { mascot: "kuchukcha" } })).status, 200);
  await t.db.pool.query("UPDATE children SET level = 3 WHERE mascot = 'kuchukcha'");
  assert.equal((await t.call("PATCH", "/api/me", { token, body: { mascot: "labubu" } })).status, 200);
  assert.equal((await t.call("PATCH", "/api/me", { token, body: { mascot: "labubu" } })).status, 200, "hozirgi qahramonni qayta saqlash mumkin");
});

test("imtihonni a’lo tugatsa — 5 baho va 'Imtihon a’lochisi' yutug‘i", async () => {
  const { token } = await t.signup("exam5");
  const s = (await t.start(token, { grade: 1, subject: "mathematics", testId: "exam" })).body;
  await t.playAll(token, s);
  const fin = await t.finish(token, s);
  assert.equal(fin.result.mark, 5);
  assert.ok(fin.newAchievements.some((a) => a.id === "exam4"));
});
