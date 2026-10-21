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

/** Sinfni almashtiradi; yangi (yoki qaytgan) profil id sini qaytaradi. */
async function switchTo(token, grade, { parent, child } = {}) {
  const r = await t.call("POST", "/api/me/grade", { token, parent, child, body: { grade } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}

test("har bir sinf — alohida profil: yutuqlar o‘z sinfida qoladi, yangi sinf noldan boshlanadi, qaytsa eskisi qaytadi", async () => {
  const { token } = await t.signup("grade"); // 1-sinf (boshlang‘ich), matematika
  const s = (await t.start(token, { grade: 1, subject: "mathematics", testId: "level-1" })).body;
  await t.playAll(token, s);
  await t.finish(token, s);

  const g1 = (await t.call("GET", "/api/progress", { token })).body;
  assert.equal(g1.grade, 1);
  assert.equal(g1.quizzes, 1);
  assert.equal(g1.bySubject.mathematics.attempts, 1);
  const points = g1.totalPoints;
  const unlocked = g1.achievements.filter((a) => a.unlocked).map((a) => a.id);
  assert.ok(points > 0 && unlocked.includes("first"));
  const childId1 = (await t.call("GET", "/api/me", { token })).body.user.child.id;

  // Oddiy PATCH bilan sinf almashmaydi (faqat birinchi tanlov), o‘sha sinfni yuborish zararsiz.
  assert.equal((await t.call("PATCH", "/api/me", { token, body: { grade: 3 } })).status, 409);
  assert.equal((await t.call("PATCH", "/api/me", { token, body: { grade: 1, name: "Yangi ism" } })).status, 200);

  // Boshlang‘ich sinfdan o‘tish — ota-ona PIN-kodi bilan
  const denied = await t.call("POST", "/api/me/grade", { token, body: { grade: 3 } });
  assert.equal(denied.status, 403);
  assert.match(denied.body.error, /ota-ona/i);
  const parent = await t.parentToken(token);
  const to3 = await switchTo(token, 3, { parent });
  assert.notEqual(to3.childId, childId1, "yangi sinf — alohida profil");
  assert.equal(to3.user.profile.grade, 3);
  assert.equal(to3.user.child.balance, 0, "yangi sinfda ball noldan");

  const g3 = (await t.call("GET", "/api/progress", { token, child: to3.childId })).body;
  assert.equal(g3.grade, 3);
  assert.equal(g3.quizzes, 0);
  assert.equal(g3.totalPoints, 0);
  assert.equal(g3.level, 1);
  assert.deepEqual(g3.achievements.filter((a) => a.unlocked), [], "yutuqlar yangi sinfda yo‘q");
  assert.deepEqual(g3.recent, []);

  // O‘quvchilar ro‘yxatida bitta odam (ikkita sinf profili emas)
  const people = (await t.call("GET", "/api/children", { token })).body;
  assert.equal(people.children.length, 1);
  assert.equal(people.activeId, people.children[0].id);

  // 1-sinfga qaytsa — hamma narsa o‘z joyida
  const back = await switchTo(token, 1, { parent, child: to3.childId });
  assert.equal(back.childId, childId1);
  const again = (await t.call("GET", "/api/progress", { token, child: back.childId })).body;
  assert.equal(again.totalPoints, points);
  assert.equal(again.quizzes, 1);
  assert.deepEqual(again.achievements.filter((a) => a.unlocked).map((a) => a.id), unlocked);
});

test("5-sinfdan boshlab sinfni ota-ona tasdig‘isiz almashtirish mumkin", async () => {
  const { token } = await t.signup("free", { grade: 7, subject: "algebra" });
  const to8 = await switchTo(token, 8);
  assert.equal(to8.user.profile.grade, 8);
  assert.equal(to8.user.profile.module, "middle");
  assert.equal(to8.user.profile.subject, "algebra", "fan yangi sinfda ham mavjud — saqlanadi");
  // O‘rta sinfdan boshlang‘ichga ham erkin
  const to2 = await switchTo(token, 2, { child: to8.childId });
  assert.equal(to2.user.profile.module, "junior");
  assert.equal(to2.user.profile.subject, "mathematics", "yangi sinfdagi tayyor fan tanlanadi");
  assert.equal((await t.call("POST", "/api/me/grade", { token, child: to2.childId, body: { grade: 13 } })).status, 400);
});

test("ota-ona hisobotida fan statistikasi sinf bo‘yicha alohida qatorlarda, hamma sinflar birga", async () => {
  const { token } = await t.signup("pgrade");
  const parent = await t.parentToken(token);
  let child;
  for (const grade of [1, 2]) {
    if (grade !== 1) child = (await switchTo(token, grade, { parent, child })).childId;
    const s = (await t.start(token, { grade, subject: "mathematics", testId: "level-1" }, child)).body;
    await t.playAll(token, s, { child });
    await t.finish(token, s, { child });
  }
  const o = (await t.call("GET", "/api/parent/overview", { token, parent, child })).body;
  assert.deepEqual(o.bySubject.map((x) => [x.subject, x.grade, x.attempts]), [["mathematics", 1, 1], ["mathematics", 2, 1]]);
  assert.equal(o.totals.tests, 2);
});

test("o‘quvchini o‘chirish barcha sinf profillarini o‘chiradi", async () => {
  const { token } = await t.signup("del1");
  const parent = await t.parentToken(token);
  const kid = (await t.call("POST", "/api/children", { token, parent, body: { name: "Madina", grade: 6 } })).body.child;
  const sw = await switchTo(token, 7, { parent, child: kid.id });
  assert.equal((await t.call("GET", "/api/children", { token })).body.children.length, 2);
  const del = await t.call("DELETE", `/api/parent/children/${sw.childId}`, { token, parent, body: { confirmName: "Madina" } });
  assert.equal(del.status, 200, JSON.stringify(del.body));
  const { rows } = await t.db.pool.query("SELECT count(*)::int AS n FROM children WHERE name = 'Madina'");
  assert.equal(rows[0].n, 0, "ikkala sinf profili ham o‘chdi");
  assert.equal((await t.call("GET", "/api/children", { token })).body.children.length, 1);
});
