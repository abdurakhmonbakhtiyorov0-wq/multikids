import test from "node:test";
import assert from "node:assert/strict";
import { allBanks, SUBJECTS, GRADES, getQuestionBank } from "../src/questions/index.js";
import { createSession, answerQuestion, summarize, QUIZ_LENGTH } from "../src/quizEngine.js";

test("har bir sinf-fan juftligida kamida 20 ta to'g'ri savol bor", () => {
  for (const s of SUBJECTS)
    for (const g of GRADES) {
      const bank = getQuestionBank(g, s);
      assert.ok(bank.length >= 20, `${s} ${g}-sinf: ${bank.length}`);
      for (const q of bank) {
        assert.equal(q.grade, g);
        assert.equal(q.subject, s);
        assert.equal(new Set(q.options).size, q.options.length, `takroriy variant: ${q.id}`);
        assert.ok(q.options.length >= 3);
      }
    }
  const total = Object.values(allBanks()).reduce((n, b) => n + b.length, 0);
  assert.ok(total >= 480, `jami ${total}`);
});

test("sessiya 20 ta takrorlanmas savoldan iborat va javob mosligi saqlanadi", () => {
  const bank = getQuestionBank(3, "english");
  const s = createSession({ userId: "u", grade: 3, subject: "english", bank });
  assert.equal(s.questions.length, QUIZ_LENGTH);
  assert.equal(new Set(s.questions.map((q) => q.id)).size, QUIZ_LENGTH);
  for (const q of s.questions) {
    const original = bank.find((b) => b.id === q.id);
    assert.equal(q.options[q.correctAnswerIndex], original.options[0]);
  }
});

test("ball va mukofotlar: takroriy javob rad etiladi, xato oxirgi mukofotni oladi", () => {
  const s = createSession({ userId: "u", grade: 1, subject: "mathematics", bank: getQuestionBank(1, "mathematics") });
  const right = (i) => s.questions[i].correctAnswerIndex;
  const wrong = (i) => (right(i) + 1) % s.questions[i].options.length;

  assert.equal(answerQuestion(s, 0, right(0)).event.item, "cap");
  assert.ok(answerQuestion(s, 0, right(0)).error, "ikkinchi marta javob qabul qilinmasligi kerak");
  assert.equal(answerQuestion(s, 1, right(1)).event.item, "clothing");
  const r = answerQuestion(s, 2, wrong(2));
  assert.deepEqual(r.event, { type: "remove", item: "clothing" });
  assert.deepEqual(r.state.equipped, ["cap"]);
  assert.equal(r.state.score, 20);

  for (let i = 3; i < QUIZ_LENGTH; i++) answerQuestion(s, i, right(i));
  const sum = summarize(s);
  assert.equal(sum.correct, 19);
  assert.equal(sum.incorrect, 1);
  assert.equal(sum.score, 190);
  assert.equal(sum.accuracy, 95);
});
