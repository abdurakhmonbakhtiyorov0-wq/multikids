// O‘quv dasturi: modullar, sinflar va har bir sinf uchun fanlar. Yagona manba — frontend buni /api/curriculum orqali oladi.
//
// Modullar: boshlang‘ich (1–4), o‘rta (5–8), yuqori (9–11), maxsus (SAT tayyorgarlik).
// Maxsus modul ichkarida 12-"sinf" sifatida saqlanadi (SPECIAL_GRADE), shuning uchun natijalar, testlar va
// ota-ona statistikasi hamma modul uchun bir xil ishlaydi; interfeysda u "SAT" deb ko‘rsatiladi.

export const SPECIAL_GRADE = 12;

export const MODULES = [
  { id: "junior", grades: [1, 2, 3, 4] },
  { id: "middle", grades: [5, 6, 7, 8] },
  { id: "senior", grades: [9, 10, 11] },
  { id: "special", grades: [SPECIAL_GRADE] },
];

export const ALL_GRADES = MODULES.flatMap((m) => m.grades);

const JUNIOR = ["mathematics", "native-language", "reading", "natural-science", "english", "russian"];
const HUMANITIES = ["native-language", "literature", "english", "russian", "history", "geography"];

/** Har bir sinfda o‘qitiladigan fanlar (Oʻzbekiston maktab dasturiga yaqin). */
const SUBJECTS_BY_GRADE = {
  1: JUNIOR,
  2: JUNIOR,
  3: JUNIOR,
  4: JUNIOR,
  5: ["mathematics", "natural-science", "informatics", ...HUMANITIES],
  6: ["mathematics", "biology", "physics", "informatics", ...HUMANITIES],
  7: ["algebra", "geometry", "biology", "physics", "chemistry", "informatics", ...HUMANITIES],
  8: ["algebra", "geometry", "biology", "physics", "chemistry", "informatics", ...HUMANITIES],
  9: ["algebra", "geometry", "biology", "physics", "chemistry", "informatics", ...HUMANITIES],
  10: ["algebra", "geometry", "biology", "physics", "chemistry", "informatics", ...HUMANITIES],
  11: ["algebra", "geometry", "biology", "physics", "chemistry", "informatics", ...HUMANITIES],
  [SPECIAL_GRADE]: ["sat-math", "sat-reading"],
};

export const ALL_SUBJECTS = [...new Set(Object.values(SUBJECTS_BY_GRADE).flat())];

/** Fan bu sinfda mavjudmi (nomzod bo‘lishi mumkin; savollari yo‘q bo‘lsa "tez orada" ko‘rsatiladi). */
export const subjectsForGrade = (grade) => SUBJECTS_BY_GRADE[grade] ?? [];
export const isOffered = (grade, subject) => subjectsForGrade(grade).includes(subject);
export const moduleOfGrade = (grade) => MODULES.find((m) => m.grades.includes(grade))?.id ?? null;

/** Fan "tayyor" deb hisoblanishi uchun kamida shuncha savol kerak (aks holda "tez orada"). */
export const READY_MIN_QUESTIONS = 15;
