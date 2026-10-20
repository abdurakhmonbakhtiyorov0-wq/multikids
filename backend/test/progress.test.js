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

test("sinf almashganda statistika va natijalar sinf bo‘yicha ajraladi, ball va yutuqlar umumiy qoladi", async () => {
  const { token } = await t.signup("grade"); // 1-sinf, matematika
  const s = (await t.start(token, { grade: 1, subject: "mathematics", testId: "level-1" })).body;
  await t.playAll(token, s);
  await t.finish(token, s);

  const g1 = (await t.call("GET", "/api/progress", { token })).body;
  assert.equal(g1.grade, 1);
  assert.equal(g1.quizzes, 1);
  assert.equal(g1.bySubject.mathematics.attempts, 1);
  assert.equal(g1.recent.length, 1);
  const points = g1.totalPoints;
  const unlocked = g1.achievements.filter((a) => a.unlocked).map((a) => a.id);
  assert.ok(points > 0 && unlocked.includes("first"));

  // Sinfni faqat ota-ona o‘zgartira oladi: PIN-kodsiz rad etiladi, o‘sha sinfni qayta yuborish zararsiz.
  const denied = await t.call("PATCH", "/api/me", { token, body: { grade: 3 } });
  assert.equal(denied.status, 403);
  assert.match(denied.body.error, /ota-ona/i);
  assert.equal((await t.call("PATCH", "/api/me", { token, body: { grade: 1, name: "Yangi ism" } })).status, 200, "o‘sha sinf — ruxsat");
  assert.equal((await t.call("GET", "/api/progress", { token })).body.grade, 1, "rad etilgach sinf o‘zgarmagan");

  // Ota-ona PIN orqali 3-sinfga o‘tdi: eski sinf natijalari ko‘rinmaydi
  const parent = await t.parentToken(token);
  assert.equal((await t.call("PATCH", "/api/me", { token, parent, body: { grade: 3 } })).status, 200);
  const g3 = (await t.call("GET", "/api/progress", { token })).body;
  assert.equal(g3.grade, 3);
  assert.equal(g3.quizzes, 0);
  assert.equal(g3.totalCorrect, 0);
  assert.equal(g3.bySubject.mathematics.attempts, 0);
  assert.equal(g3.bySubject.mathematics.bestScore, 0);
  assert.deepEqual(g3.recent, []);
  assert.deepEqual(g3.rewards, []);
  // umumiy: ball, daraja, yutuqlar saqlanadi
  assert.equal(g3.totalPoints, points);
  assert.deepEqual(g3.achievements.filter((a) => a.unlocked).map((a) => a.id), unlocked);
  assert.equal(g3.balance, g1.balance);

  // 1-sinfga qaytsa — natijalar o‘z joyida
  await t.call("PATCH", "/api/me", { token, parent, body: { grade: 1 } });
  const back = (await t.call("GET", "/api/progress", { token })).body;
  assert.equal(back.quizzes, 1);
  assert.equal(back.recent.length, 1);
});

test("ota-ona hisobotida fan statistikasi sinf bo‘yicha alohida qatorlarda", async () => {
  const { token } = await t.signup("pgrade");
  const parent = await t.parentToken(token);
  for (const grade of [1, 2]) {
    assert.equal((await t.call("PATCH", "/api/me", { token, parent, body: { grade } })).status, 200);
    const s = (await t.start(token, { grade, subject: "mathematics", testId: "level-1" })).body;
    await t.playAll(token, s);
    await t.finish(token, s);
  }
  const o = (await t.call("GET", "/api/parent/overview", { token, parent })).body;
  assert.deepEqual(o.bySubject.map((x) => [x.subject, x.grade, x.attempts]), [["mathematics", 1, 1], ["mathematics", 2, 1]]);
});
