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

test("o‘quv dasturi (ochiq): 4 modul, sinflar, fanlar va tayyorlik holati", async () => {
  const r = await t.call("GET", "/api/curriculum");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.modules.map((m) => m.id), ["junior", "middle", "senior", "special"]);
  assert.deepEqual(r.body.modules.map((m) => m.grades.map((g) => g.grade)), [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11], [12]]);
  const find = (grade, subject) => r.body.modules.flatMap((m) => m.grades).find((g) => g.grade === grade).subjects.find((s) => s.id === subject);
  assert.equal(find(1, "mathematics").ready, true);
  assert.equal(find(9, "biology").ready, true);
  assert.equal(find(12, "sat-math").ready, true);
  assert.equal(find(12, "sat-reading").ready, true);
  for (const [grade, subject] of [[10, "history"], [8, "geography"], [11, "literature"], [7, "native-language"], [9, "russian"], [5, "natural-science"]]) {
    assert.equal(find(grade, subject).ready, true, `${grade}-sinf ${subject} tayyor`);
    assert.ok(find(grade, subject).questions >= 24);
  }
});

test("o‘rta modul: sinf tanlangach modul aniqlanadi, fan sinfga mos bo‘lishi shart", async () => {
  const { token } = await t.signup("mid", { grade: 7, subject: "algebra" });
  const me = (await t.call("GET", "/api/me", { token })).body.user;
  assert.equal(me.profile.module, "middle");
  assert.equal(me.profile.grade, 7);
  assert.equal(me.profile.subject, "algebra");

  const wrong = await t.call("PATCH", "/api/me", { token, body: { subject: "sat-math" } });
  assert.equal(wrong.status, 400, "7-sinfda SAT fani yo‘q");
  assert.equal((await t.start(token, { grade: 7, subject: "sat-math" })).status, 400);
  assert.equal((await t.call("GET", "/api/tests?grade=7&subject=sat-math", { token })).status, 400);
});

test("o‘rta va yuqori modulda test boshidan oxirigacha ishlaydi (algebra, kimyo, biologiya)", async () => {
  const { token } = await t.signup("play", { grade: 8, subject: "chemistry" });
  const tests = (await t.call("GET", "/api/tests?grade=8&subject=chemistry", { token })).body.tests;
  assert.ok(tests.find((x) => x.id === "level-1").available);

  for (const [grade, subject] of [[8, "chemistry"], [9, "algebra"], [9, "biology"]]) {
    const { token: tk } = await t.signup(`p${grade}${subject}`, { grade, subject });
    const started = await t.start(tk, { grade, subject, testId: "level-1" });
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const s = started.body;
    assert.ok(s.total >= 8 && s.total <= 10, `${subject}: ${s.total} ta savol`);
    await t.playAll(tk, s, { wrongAt: [0] });
    const fin = await t.finish(tk, s);
    assert.equal(fin.result.grade, grade);
    assert.equal(fin.result.subject, subject);
    assert.equal(fin.result.incorrect, 1);
    const prog = (await t.call("GET", "/api/progress", { token: tk })).body;
    assert.equal(prog.grade, grade);
    assert.ok(Object.keys(prog.bySubject).includes(subject), "progress shu sinfdagi fanlar bo‘yicha");
    assert.ok(!Object.keys(prog.bySubject).includes("reading"), "boshlang‘ich fani yuqori sinfda ko‘rinmaydi");
    assert.equal(prog.bySubject[subject].attempts, 1);
  }
});

test("maxsus modul (SAT): ikkita fan, test va imtihon rejimi ishlaydi", async () => {
  const { token } = await t.signup("sat", { grade: 12, subject: "sat-math" });
  const me = (await t.call("GET", "/api/me", { token })).body.user;
  assert.equal(me.profile.module, "special");

  const prog = (await t.call("GET", "/api/progress", { token })).body;
  assert.deepEqual(Object.keys(prog.bySubject).sort(), ["sat-math", "sat-reading"]);

  const s = (await t.start(token, { grade: 12, subject: "sat-reading", testId: "level-1" })).body;
  await t.playAll(token, s);
  assert.equal((await t.finish(token, s)).result.subject, "sat-reading");

  const exam = (await t.start(token, { grade: 12, subject: "sat-math", testId: "exam" })).body;
  assert.ok(exam.deadlineAt, "imtihon vaqt bilan cheklangan");
  await t.playAll(token, exam);
  const done = await t.finish(token, exam);
  assert.ok([2, 3, 4, 5].includes(done.result.mark));
});

test("sinf almashganda yangi sinfda fan mavjud bo‘lmasa, tayyor fan tanlanadi", async () => {
  const { token } = await t.signup("sw", { grade: 7, subject: "algebra" });
  const r = await t.call("POST", "/api/me/grade", { token, body: { grade: 12 } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.profile.grade, 12);
  assert.equal(r.body.user.profile.subject, "sat-math");
  assert.equal(r.body.user.profile.module, "special");

  const back = await t.call("POST", "/api/me/grade", { token, child: r.body.childId, body: { grade: 2 } });
  assert.equal(back.status, 200);
  assert.equal(back.body.user.profile.subject, "mathematics");
  assert.equal(back.body.user.profile.module, "junior");
});

test("noto‘g‘ri sinf (13 yoki 0) rad etiladi", async () => {
  const { token } = await t.signup("g13", { grade: 5, subject: "mathematics" });
  assert.equal((await t.call("POST", "/api/me/grade", { token, body: { grade: 13 } })).status, 400);
  assert.equal((await t.call("POST", "/api/me/grade", { token, body: { grade: 0 } })).status, 400);
  assert.equal((await t.call("PATCH", "/api/me", { token, body: { grade: 13 } })).status, 400);
});
