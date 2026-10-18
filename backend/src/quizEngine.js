import crypto from "node:crypto";

export const QUIZ_LENGTH = 20;
export const POINTS_PER_CORRECT = 10;
// Mukofotlar ketma-ketligi: har bir to'g'ri javob keyingi kiyilmagan buyumni beradi.
export const REWARD_SEQUENCE = ["cap", "clothing", "trophy", "ball", "glasses", "crown"];

export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Savollar bankidan 20 ta takrorlanmas savol tanlab, variantlarini aralashtiradi. */
export function buildSessionQuestions(bank, rand = Math.random) {
  if (bank.length < QUIZ_LENGTH) throw new Error("Savollar yetarli emas");
  return shuffle(bank, rand)
    .slice(0, QUIZ_LENGTH)
    .map((q) => {
      const order = shuffle(q.options.map((_, i) => i), rand);
      return {
        ...q,
        options: order.map((i) => q.options[i]),
        correctAnswerIndex: order.indexOf(q.correctAnswerIndex),
      };
    });
}

export function createSession({ userId, grade, subject, bank }) {
  return {
    id: crypto.randomUUID(),
    userId,
    grade,
    subject,
    questions: buildSessionQuestions(bank),
    answers: new Array(QUIZ_LENGTH).fill(null),
    correct: 0,
    incorrect: 0,
    streak: 0,
    bestStreak: 0,
    equipped: [],
    earned: [],
    startedAt: Date.now(),
    finished: false,
  };
}

/** Javobni qayd etadi. Bir savolga faqat bir marta javob berish mumkin. */
export function answerQuestion(session, index, answer) {
  if (session.finished) return { error: "Test allaqachon tugagan" };
  if (!Number.isInteger(index) || index < 0 || index >= QUIZ_LENGTH) return { error: "Noto‘g‘ri savol raqami" };
  if (session.answers[index] !== null) return { error: "Bu savolga allaqachon javob berilgan" };
  const firstOpen = session.answers.indexOf(null);
  if (index !== firstOpen) return { error: "Savollarga tartib bilan javob bering" };
  const q = session.questions[index];
  if (!Number.isInteger(answer) || answer < 0 || answer >= q.options.length) return { error: "Noto‘g‘ri javob varianti" };

  const correct = answer === q.correctAnswerIndex;
  session.answers[index] = answer;
  let event;
  if (correct) {
    session.correct++;
    session.streak++;
    session.bestStreak = Math.max(session.bestStreak, session.streak);
    const next = REWARD_SEQUENCE.find((r) => !session.equipped.includes(r));
    if (next) {
      session.equipped.push(next);
      if (!session.earned.includes(next)) session.earned.push(next);
      event = { type: "equip", item: next };
    } else {
      event = { type: "celebrate" };
    }
  } else {
    session.incorrect++;
    session.streak = 0;
    const removed = session.equipped.pop() ?? null;
    event = { type: "remove", item: removed };
  }
  return {
    correct,
    correctIndex: q.correctAnswerIndex,
    explanation: q.explanation,
    event,
    state: publicState(session),
  };
}

export function publicState(s) {
  return {
    answered: s.answers.filter((a) => a !== null).length,
    correct: s.correct,
    incorrect: s.incorrect,
    score: s.correct * POINTS_PER_CORRECT,
    streak: s.streak,
    equipped: [...s.equipped],
    earned: [...s.earned],
  };
}

export function summarize(s) {
  const score = s.correct * POINTS_PER_CORRECT;
  return {
    id: s.id,
    userId: s.userId,
    grade: s.grade,
    subject: s.subject,
    total: QUIZ_LENGTH,
    correct: s.correct,
    incorrect: s.incorrect,
    score,
    maxScore: QUIZ_LENGTH * POINTS_PER_CORRECT,
    accuracy: Math.round((s.correct / QUIZ_LENGTH) * 100),
    bestStreak: s.bestStreak,
    equipped: [...s.equipped],
    earned: [...s.earned],
    durationSec: Math.round((Date.now() - s.startedAt) / 1000),
    createdAt: new Date().toISOString(),
    answers: s.questions.map((q, i) => ({
      questionId: q.id,
      prompt: q.prompt,
      options: q.options,
      chosen: s.answers[i],
      correctIndex: q.correctAnswerIndex,
      explanation: q.explanation,
    })),
  };
}
