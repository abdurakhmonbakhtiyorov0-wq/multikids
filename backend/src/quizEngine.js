import crypto from "node:crypto";
import { pointsFor } from "./tests.js";

// Sof (bazaga bog‘lanmagan) test qoidalari: qiyinlik, moslashuv, mukofotlar, o‘zlashtirish.
// Barcha holat javoblar tarixidan qayta hisoblanadi (replay), shuning uchun serverda xotira kerak emas.

export const QUIZ_LENGTH = 20;
export const COMPLETION_XP = 10;
export const MASTERY_STREAK = 3; // ketma-ket to‘g‘ri javoblar soni — xato "o‘zlashtirilgan" hisoblanadi
export const ADAPT_UP_AFTER = 3; // ketma-ket to‘g‘ri -> qiyinroq
export const ADAPT_DOWN_AFTER = 2; // ketma-ket noto‘g‘ri -> osonroq
export const MAX_CHILDREN = 8;

// Mukofotlar ketma-ketligi: har bir to'g'ri javob keyingi kiyilmagan buyumni beradi.
export const REWARD_SEQUENCE = ["cap", "clothing", "trophy", "ball", "glasses", "crown"];
export const DIFFICULTY_NAMES = { 1: "easy", 2: "medium", 3: "hard" };

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// --- Takrorlanuvchan tasodifiylik (variantlar tartibi sessiya ID siga bog‘liq) ---
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededRandom(seed) {
  return mulberry32(crypto.createHash("sha256").update(String(seed)).digest().readUInt32LE(0));
}

export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Variantlarni sessiya+savol bo‘yicha barqaror tartibda aralashtiradi. To‘g‘ri javob indeksi ham qaytadi. */
export function arrangeOptions(sessionId, questionId, options, correctIndex) {
  const order = shuffle(options.map((_, i) => i), seededRandom(`${sessionId}:${questionId}`));
  return { options: order.map((i) => options[i]), correctIndex: order.indexOf(correctIndex) };
}

// --- Qiyinlik ---
/** Test boshida oson, o‘rtada o‘rta, oxirida qiyin savollar. */
export function rampDifficulty(index, total) {
  const r = index / total;
  return r < 0.35 ? 1 : r < 0.7 ? 2 : 3;
}

export function targetDifficulty(index, total, offset = 0) {
  return clamp(rampDifficulty(index, total) + offset, 1, 3);
}

/** Moslashuv: tasodifiy bitta javobga emas, qator javoblarga qarab siljitadi. */
export function adapt(state, correct) {
  let { correctStreak, wrongStreak, offset } = state;
  if (correct) {
    correctStreak++;
    wrongStreak = 0;
    if (correctStreak >= ADAPT_UP_AFTER && offset < 1) {
      offset++;
      correctStreak = 0;
    }
  } else {
    wrongStreak++;
    correctStreak = 0;
    if (wrongStreak >= ADAPT_DOWN_AFTER && offset > -1) {
      offset--;
      wrongStreak = 0;
    }
  }
  return { correctStreak, wrongStreak, offset };
}

// --- Ochko, daraja ---
/** Bir to‘g‘ri javob uchun ball: test bosqichiga qarab (tests.js). */
export const pointsPerCorrect = (mode, testId) => pointsFor(mode, testId);

const LEVEL_TITLES = ["Yangi boshlovchi", "Qiziquvchi", "Izlanuvchi", "Bilimdon", "Mohir", "Ustoz", "Dono"];
export const levelTitle = (level) => LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1];

export function levelForXp(xp) {
  return 1 + Math.floor(Math.sqrt(xp / 50));
}
/** Keyingi darajagacha: [joriy darajaga kerak bo‘lgan XP, keyingisiga kerak bo‘lgan XP]. */
export function levelBounds(level) {
  return [50 * (level - 1) ** 2, 50 * level ** 2];
}

// --- Holatni javoblar tarixidan qayta hisoblash ---
/** answers: [{ isCorrect }] pozitsiya tartibida. Har bir qadam uchun mukofot hodisasi ham qaytadi. */
export function replay(answers) {
  const st = { correct: 0, incorrect: 0, streak: 0, bestStreak: 0, equipped: [], earned: [] };
  const events = [];
  for (const a of answers) {
    if (a.isCorrect) {
      st.correct++;
      st.streak++;
      st.bestStreak = Math.max(st.bestStreak, st.streak);
      const next = REWARD_SEQUENCE.find((r) => !st.equipped.includes(r));
      if (next) {
        st.equipped.push(next);
        if (!st.earned.includes(next)) st.earned.push(next);
        events.push({ type: "equip", item: next });
      } else {
        events.push({ type: "celebrate" });
      }
    } else {
      st.incorrect++;
      st.streak = 0;
      events.push({ type: "remove", item: st.equipped.pop() ?? null });
    }
  }
  return { ...st, events };
}

export function publicState(r, mode = "quiz", testId = "mixed") {
  return {
    answered: r.correct + r.incorrect,
    correct: r.correct,
    incorrect: r.incorrect,
    score: r.correct * pointsPerCorrect(mode, testId),
    streak: r.streak,
    equipped: [...r.equipped],
    earned: [...r.earned],
  };
}

// --- Kunlar (bola vaqt mintaqasi bo‘yicha) ---
export function dayInZone(date, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

const dayNumber = (iso) => Math.floor(Date.UTC(...iso.split("-").map((n, i) => (i === 1 ? n - 1 : +n))) / 86_400_000);

/** Seriya: shu kunda allaqachon bo‘lsa o‘zgarmaydi; kecha bo‘lsa +1; aks holda 1. */
export function nextStreak({ lastDay, current, best }, today) {
  let streak;
  if (!lastDay) streak = 1;
  else if (lastDay === today) streak = Math.max(current, 1);
  else if (dayNumber(today) - dayNumber(lastDay) === 1) streak = current + 1;
  else streak = 1;
  return { current: streak, best: Math.max(best, streak) };
}
