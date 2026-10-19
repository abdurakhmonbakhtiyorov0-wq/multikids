import test from "node:test";
import assert from "node:assert/strict";
import {
  arrangeOptions, rampDifficulty, targetDifficulty, adapt, replay, levelForXp, levelBounds, nextStreak, dayInZone, REWARD_SEQUENCE,
} from "../src/quizEngine.js";
import { collectQuestions, validateQuestion } from "../scripts/seed.js";
import { SUBJECTS, GRADES } from "../src/questions/index.js";

test("savollar banki: har bir sinf-fan juftligida kamida 20 ta, hammasi yaroqli", () => {
  const all = collectQuestions();
  const ids = new Set();
  for (const q of all) {
    assert.equal(validateQuestion(q), null, q.id);
    assert.ok(!ids.has(q.id), `takroriy ID ${q.id}`);
    ids.add(q.id);
  }
  for (const s of SUBJECTS)
    for (const g of GRADES) {
      const n = all.filter((q) => q.subject === s && q.grade === g).length;
      assert.ok(n >= 20, `${s} ${g}-sinf: ${n}`);
    }
});

test("generatsiya qilingan matematika savollarining javoblari hisob bo‘yicha to‘g‘ri", () => {
  const gen = collectQuestions().filter((q) => q.id.includes("-gen-"));
  assert.ok(gen.length >= 120);
  for (const q of gen) {
    const m = q.prompt.match(/^(\d+) ([+−×÷]) (\d+) = \?$/);
    if (!m) continue;
    const [a, b] = [Number(m[1]), Number(m[3])];
    const expected = { "+": a + b, "−": a - b, "×": a * b, "÷": a / b }[m[2]];
    assert.equal(Number(q.options[q.correctIndex]), expected, q.prompt);
  }
});

test("variantlar tartibi sessiyaga bog‘liq, barqaror va to‘g‘ri javobni saqlaydi", () => {
  const opts = ["A", "B", "C", "D"];
  const x = arrangeOptions("s1", "q1", opts, 0);
  assert.deepEqual(x, arrangeOptions("s1", "q1", opts, 0));
  assert.equal(x.options[x.correctIndex], "A");
  assert.deepEqual([...x.options].sort(), opts);
});

test("qiyinlik: oson -> o‘rta -> qiyin, siljish chegaralanadi", () => {
  const seq = Array.from({ length: 20 }, (_, i) => rampDifficulty(i, 20));
  assert.deepEqual(seq, [...seq].sort());
  assert.equal(seq[0], 1);
  assert.equal(seq[19], 3);
  assert.equal(targetDifficulty(0, 20, -1), 1);
  assert.equal(targetDifficulty(19, 20, 1), 3);
  assert.equal(targetDifficulty(10, 20, 1), 3);
});

test("moslashuv: bitta xato qiyinlikni o‘zgartirmaydi, qator xatolar pasaytiradi, qator to‘g‘rilar oshiradi", () => {
  let st = { correctStreak: 0, wrongStreak: 0, offset: 0 };
  st = adapt(st, false);
  assert.equal(st.offset, 0);
  st = adapt(st, true);
  assert.equal(st.offset, 0);
  st = adapt(adapt(st, false), false);
  assert.equal(st.offset, -1);
  st = adapt(adapt(st, false), false);
  assert.equal(st.offset, -1, "pastki chegaradan pastga tushmaydi");
  for (let i = 0; i < 3; i++) st = adapt(st, true);
  assert.equal(st.offset, 0);
  for (let i = 0; i < 6; i++) st = adapt(st, true);
  assert.equal(st.offset, 1, "yuqori chegaradan oshmaydi");
});

test("mukofotlar: to‘g‘ri javob kiyim beradi, xato oxirgisini oladi", () => {
  const r = replay([{ isCorrect: true }, { isCorrect: true }, { isCorrect: false }, { isCorrect: true }]);
  assert.deepEqual(r.events.map((e) => e.type), ["equip", "equip", "remove", "equip"]);
  assert.deepEqual(r.events[2], { type: "remove", item: REWARD_SEQUENCE[1] });
  assert.deepEqual(r.equipped, [REWARD_SEQUENCE[0], REWARD_SEQUENCE[1]]);
  assert.equal(r.bestStreak, 2);
  assert.equal(r.correct, 3);
  assert.equal(r.incorrect, 1);
});

test("daraja XP bo‘yicha o‘sadi va chegaralar mos keladi", () => {
  assert.equal(levelForXp(0), 1);
  for (const xp of [0, 49, 50, 199, 200, 450, 5000]) {
    const lvl = levelForXp(xp);
    const [lo, hi] = levelBounds(lvl);
    assert.ok(xp >= lo && xp < hi, `xp ${xp} daraja ${lvl} [${lo}, ${hi})`);
  }
});

test("kunlik seriya: bir kunda ko‘p test seriyani oshirmaydi, bir kun tanaffus uzadi", () => {
  const base = { current: 3, best: 5 };
  assert.deepEqual(nextStreak({ lastDay: null, ...base }, "2026-10-19"), { current: 1, best: 5 });
  assert.deepEqual(nextStreak({ lastDay: "2026-10-19", ...base }, "2026-10-19"), { current: 3, best: 5 });
  assert.deepEqual(nextStreak({ lastDay: "2026-10-18", ...base }, "2026-10-19"), { current: 4, best: 5 });
  assert.deepEqual(nextStreak({ lastDay: "2026-10-17", ...base }, "2026-10-19"), { current: 1, best: 5 });
  assert.deepEqual(nextStreak({ lastDay: "2026-10-31", current: 5, best: 5 }, "2026-11-01"), { current: 6, best: 6 });
});

test("kun vaqt mintaqasi bo‘yicha hisoblanadi", () => {
  const d = new Date("2026-10-19T22:30:00Z");
  assert.equal(dayInZone(d, "UTC"), "2026-10-19");
  assert.equal(dayInZone(d, "Asia/Tashkent"), "2026-10-20");
  assert.equal(dayInZone(d, "Nope/Nowhere"), "2026-10-19");
});
