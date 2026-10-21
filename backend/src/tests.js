// Test katalogi: har bir sinf va fan uchun 5 ta bosqichli test, moslashuvchan aralash test va sinov imtihoni.
// Barcha qoidalar (savol soni, qiyinlik, ball, ochilish sharti) serverda — mijoz ularni o‘zgartira olmaydi.

export const UNLOCK_ACCURACY = 60; // keyingi bosqich ochilishi uchun oldingi bosqichdagi eng yaxshi aniqlik, %
export const EXAM_TIME_LIMIT_SEC = 20 * 60;

export const TESTS = [
  { id: "level-1", kind: "level", order: 1, difficulties: [1], length: 10, points: 5, label: "Boshlang‘ich", title: "1-bosqich · Boshlang‘ich", note: "Eng oson savollar" },
  { id: "level-2", kind: "level", order: 2, difficulties: [1, 2], length: 10, points: 7, label: "Oson", title: "2-bosqich · Oson", note: "Osondan o‘rtagacha" },
  { id: "level-3", kind: "level", order: 3, difficulties: [2], length: 10, points: 10, label: "O‘rta", title: "3-bosqich · O‘rta", note: "O‘rta darajadagi savollar" },
  { id: "level-4", kind: "level", order: 4, difficulties: [2, 3], length: 10, points: 12, label: "Murakkab", title: "4-bosqich · Murakkab", note: "O‘rtadan qiyingacha" },
  { id: "level-5", kind: "level", order: 5, difficulties: [3], length: 10, points: 15, label: "Qiyin", title: "5-bosqich · Qiyin", note: "Eng qiyin savollar" },
  { id: "mixed", kind: "mixed", order: 6, difficulties: [1, 2, 3], length: 20, points: 10, label: "Aralash", title: "Aralash test", note: "Sizning darajangizga moslashadi" },
  { id: "exam", kind: "exam", order: 7, difficulties: [1, 2, 3], length: 20, points: 12, label: "Imtihon", title: "Sinov imtihoni", note: "Vaqt cheklangan, yakunida baho qo‘yiladi", timeLimitSec: EXAM_TIME_LIMIT_SEC },
];

export const TEST_BY_ID = Object.fromEntries(TESTS.map((t) => [t.id, t]));
export const LEVEL_TESTS = TESTS.filter((t) => t.kind === "level");

/** Sessiya rejimi: oddiy testlar "quiz", imtihon "exam". ("mistakes" alohida.) */
export const modeForTest = (testId) => (TEST_BY_ID[testId]?.kind === "exam" ? "exam" : "quiz");

/** Bir to‘g‘ri javob uchun ball. */
export function pointsFor(mode, testId) {
  if (mode === "mistakes") return 5;
  return TEST_BY_ID[testId]?.points ?? 10;
}

/** Bosqichli testda i-savol uchun maqsad qiyinlik: ruxsat etilgan darajalar bo‘ylab silliq o‘sadi. */
export function levelTargetDifficulty(test, index, total) {
  const d = test.difficulties;
  return d[Math.min(d.length - 1, Math.floor((index / total) * d.length))];
}

/** 5 ballik tizimda baho (O‘zbekiston maktablari). */
export function markFor(accuracy) {
  return accuracy >= 90 ? 5 : accuracy >= 75 ? 4 : accuracy >= 55 ? 3 : 2;
}
