import mathematics from "./mathematics.js";
import nativeLanguage from "./native-language.js";
import reading from "./reading.js";
import naturalScience from "./natural-science.js";
import english from "./english.js";
import russian from "./russian.js";
import extraMathematics from "./extra/mathematics.js";
import extraNativeLanguage from "./extra/native-language.js";
import extraReading from "./extra/reading.js";
import extraNaturalScience from "./extra/natural-science.js";
import extraEnglish from "./extra/english.js";
import extraRussian from "./extra/russian.js";

export const SUBJECTS = ["mathematics", "native-language", "reading", "natural-science", "english", "russian"];
export const GRADES = [1, 2, 3, 4];

const raw = {
  mathematics,
  "native-language": nativeLanguage,
  reading,
  "natural-science": naturalScience,
  english,
  russian,
};

const extra = {
  mathematics: extraMathematics,
  "native-language": extraNativeLanguage,
  reading: extraReading,
  "natural-science": extraNaturalScience,
  english: extraEnglish,
  russian: extraRussian,
};
const LEVEL_NAME = { 1: "easy", 2: "medium", 3: "hard" };

function difficultyFor(index, total) {
  const r = index / total;
  return r < 0.35 ? "easy" : r < 0.7 ? "medium" : "hard";
}

// Fayllardagi ixcham yozuvni to'liq Question obyektlariga aylantiradi.
// To'g'ri javob doim options[0] da saqlanadi; sessiyada aralashtiriladi.
const bank = {};
for (const subject of SUBJECTS) {
  for (const grade of GRADES) {
    const list = raw[subject][grade] ?? [];
    bank[`${subject}:${grade}`] = list.map(([prompt, correct, wrong, explanation], i) => ({
      id: `${subject}-g${grade}-${String(i + 1).padStart(2, "0")}`,
      grade,
      subject,
      prompt,
      options: [correct, ...wrong],
      correctAnswerIndex: 0,
      explanation: explanation ?? `To‘g‘ri javob: ${correct}`,
      difficulty: difficultyFor(i, list.length),
    }));
    // Qo‘shimcha savollar: qiyinlik aniq ko‘rsatilgan, ID lari "-x01" ko‘rinishida.
    (extra[subject][grade] ?? []).forEach(([level, prompt, correct, wrong, explanation], i) => {
      bank[`${subject}:${grade}`].push({
        id: `${subject}-g${grade}-x${String(i + 1).padStart(2, "0")}`,
        grade,
        subject,
        prompt,
        options: [correct, ...wrong],
        correctAnswerIndex: 0,
        explanation: explanation ?? `To‘g‘ri javob: ${correct}`,
        difficulty: LEVEL_NAME[level],
      });
    });
  }
}

export function getQuestionBank(grade, subject) {
  return bank[`${subject}:${grade}`] ?? [];
}

export function allBanks() {
  return bank;
}
