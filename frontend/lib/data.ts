/** 1–11-sinflar va 12 = maxsus modul (SAT). Qaysi fan qaysi sinfda bor — serverda (/api/curriculum). */
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type ModuleId = "junior" | "middle" | "senior" | "special";
export type Subject =
  | "mathematics"
  | "native-language"
  | "reading"
  | "natural-science"
  | "english"
  | "russian"
  | "algebra"
  | "geometry"
  | "physics"
  | "chemistry"
  | "biology"
  | "history"
  | "geography"
  | "literature"
  | "informatics"
  | "sat-math"
  | "sat-reading";
export type MascotId =
  | "ajdarcha"
  | "pandacha"
  | "labubu"
  | "mushukcha"
  | "robotcha"
  | "ayiqcha"
  | "minioncha"
  | "spidermancha"
  | "mariocha"
  | "kuchukcha"
  | "yulduzcha";
export type RewardId = "cap" | "clothing" | "trophy" | "ball" | "glasses" | "crown";

export type EarStyle = "round" | "pointy" | "floppy" | "bunny" | "wide" | "none";
export type Extra = "dragon" | "panda" | "labubu" | "cat" | "robot" | "bear" | "minion" | "spider" | "mario" | "dog" | "star";

export type Character = {
  id: MascotId;
  name: string;
  tagline: string;
  head: string;
  body: string;
  limbs: string;
  belly?: string;
  accent: string;
  ears: EarStyle;
  extra: Extra;
  headR: number;
};

// Barcha qahramonlar — original, protsedura yo'li bilan yaratilgan talqinlar.
export const CHARACTERS: Character[] = [
  { id: "ajdarcha", name: "Ajdarcha", tagline: "Mehribon kichkina ajdar", head: "#5cc98a", body: "#5cc98a", limbs: "#4bb579", belly: "#fde68a", accent: "#fff3c4", ears: "none", extra: "dragon", headR: 0.5 },
  { id: "pandacha", name: "Pandacha", tagline: "Yoqimtoy bambuk sevuvchi", head: "#ffffff", body: "#ffffff", limbs: "#2b2b33", accent: "#2b2b33", ears: "round", extra: "panda", headR: 0.52 },
  { id: "labubu", name: "Labubu", tagline: "Sho‘x va quvnoq maxluqcha", head: "#c9a27e", body: "#c9a27e", limbs: "#b58c68", belly: "#f3dfc8", accent: "#f7b6c2", ears: "bunny", extra: "labubu", headR: 0.5 },
  { id: "mushukcha", name: "Mushukcha", tagline: "Qiziquvchan mushukcha", head: "#f6a04d", body: "#f6a04d", limbs: "#e8913f", belly: "#ffe3c2", accent: "#ffc6a5", ears: "pointy", extra: "cat", headR: 0.5 },
  { id: "robotcha", name: "Robotcha", tagline: "Aqlli kelajak roboti", head: "#a9c2e6", body: "#8fabd6", limbs: "#7895c4", accent: "#38bdf8", ears: "none", extra: "robot", headR: 0.46 },
  { id: "ayiqcha", name: "Ayiqcha", tagline: "Momiq do‘st ayiqcha", head: "#a0673f", body: "#a0673f", limbs: "#8f5a35", belly: "#e8c7a0", accent: "#e8c7a0", ears: "round", extra: "bear", headR: 0.5 },
  { id: "minioncha", name: "Minioncha", tagline: "Quvnoq sariq yordamchi", head: "#ffd93b", body: "#ffd93b", limbs: "#2f6fd6", accent: "#2f6fd6", ears: "none", extra: "minion", headR: 0.5 },
  { id: "spidermancha", name: "Spider-Mancha", tagline: "Do‘stona o‘rgimchak qahramon", head: "#e23b3b", body: "#2a4fb8", limbs: "#e23b3b", accent: "#2a4fb8", ears: "none", extra: "spider", headR: 0.5 },
  { id: "mariocha", name: "Mariocha", tagline: "Sakrovchi quvnoq qahramon", head: "#f6c9a0", body: "#2f5fd0", limbs: "#e0393e", accent: "#e0393e", ears: "none", extra: "mario", headR: 0.48 },
  { id: "kuchukcha", name: "Kuchukcha", tagline: "Sadoqatli kuchukcha", head: "#e7c595", body: "#e7c595", limbs: "#d9b27d", belly: "#fff1dc", accent: "#9a6b3f", ears: "floppy", extra: "dog", headR: 0.5 },
  { id: "yulduzcha", name: "Yulduzcha", tagline: "Kosmosdan kelgan do‘st", head: "#8d7bf0", body: "#8d7bf0", limbs: "#7a68de", belly: "#ffe9a8", accent: "#ffb36b", ears: "wide", extra: "star", headR: 0.5 },
];

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c])) as Record<MascotId, Character>;

/** Maxsus modul (SAT) ichkarida shu "sinf" raqami bilan saqlanadi. */
export const SPECIAL_GRADE: Grade = 12;

export const GRADES: { id: Grade; title: string; note: string; emoji: string }[] = [
  { id: 1, title: "1-sinf", note: "Harflar, sonlar va birinchi kashfiyotlar", emoji: "🌱" },
  { id: 2, title: "2-sinf", note: "Ko‘paytirish va yangi so‘zlar", emoji: "🌿" },
  { id: 3, title: "3-sinf", note: "Murakkabroq masalalar va matnlar", emoji: "🌳" },
  { id: 4, title: "4-sinf", note: "Kasrlar, adabiyot va tabiat sirlari", emoji: "🏔️" },
  { id: 5, title: "5-sinf", note: "Matematika va tabiat fanlariga kirish", emoji: "5" },
  { id: 6, title: "6-sinf", note: "Biologiya va fizikaning boshlanishi", emoji: "6" },
  { id: 7, title: "7-sinf", note: "Algebra, geometriya, kimyo", emoji: "7" },
  { id: 8, title: "8-sinf", note: "Tenglamalar, fizika va kimyo asoslari", emoji: "8" },
  { id: 9, title: "9-sinf", note: "Progressiyalar, aylana, genetika", emoji: "9" },
  { id: 10, title: "10-sinf", note: "Logarifm, stereometriya, organik kimyo", emoji: "10" },
  { id: 11, title: "11-sinf", note: "Hosila, integral va yakuniy tayyorgarlik", emoji: "11" },
  { id: 12, title: "SAT", note: "Math va Reading & Writing", emoji: "SAT" },
];

/** Sinf yozuvi: 12 — "SAT", qolganlari — "N-sinf". */
export const gradeLabel = (t: (key: string, vars?: Record<string, string | number>) => string, grade: number | null | undefined) =>
  grade === SPECIAL_GRADE ? "SAT" : t("{n}-sinf", { n: grade ?? "" });

export type ModuleInfo = {
  id: ModuleId;
  title: string;
  ages: string;
  grades: Grade[];
  tagline: string;
  description: string;
  /** Qahramon (3D do‘st) va o‘yin elementlari faqat boshlang‘ich modulda. */
  playful: boolean;
};

export const MODULES: ModuleInfo[] = [
  { id: "junior", title: "Boshlang‘ich", ages: "1–4-sinf", grades: [1, 2, 3, 4], tagline: "O‘yin orqali o‘rganamiz", description: "3D qahramon do‘st, mukofotlar va quvnoq testlar. Matematika, ona tili, o‘qish, ingliz va rus tillari.", playful: true },
  { id: "middle", title: "O‘rta", ages: "5–8-sinf", grades: [5, 6, 7, 8], tagline: "Bilimni mustahkamlaymiz", description: "Jiddiy va ixcham interfeys. Algebra, geometriya, fizika, kimyo, biologiya, tarix va boshqa fanlar bo‘yicha testlar.", playful: false },
  { id: "senior", title: "Yuqori", ages: "9–11-sinf", grades: [9, 10, 11], tagline: "Fan va texnologiya", description: "Zamonaviy animatsiyali muhit, ilmiy 3D vizualizatsiya. Aniq fanlar, kimyo, biologiya va yakuniy imtihonlarga tayyorgarlik.", playful: false },
  { id: "special", title: "Maxsus", ages: "SAT tayyorgarlik", grades: [12], tagline: "Xalqaro imtihonga tayyorlanamiz", description: "SAT Math va Reading & Writing: bosqichli mashqlar va vaqtli sinov imtihoni.", playful: false },
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<ModuleId, ModuleInfo>;
export const moduleOfGrade = (grade: number | null | undefined): ModuleId | null => MODULES.find((m) => m.grades.includes(grade as Grade))?.id ?? null;

export const SUBJECTS: { id: Subject; title: string; description: string; emoji: string; tint: string; abbr: string }[] = [
  { id: "mathematics", title: "Matematika", description: "Sonlar, misollar va masalalar", emoji: "🔢", tint: "#dbeafe", abbr: "Mat" },
  { id: "native-language", title: "Ona tili", description: "Harflar, so‘zlar va gaplar", emoji: "✍️", tint: "#e0f2fe", abbr: "Ona" },
  { id: "reading", title: "O‘qish", description: "Ertaklar, she’rlar va matnlar", emoji: "📖", tint: "#e0e7ff", abbr: "O‘q" },
  { id: "natural-science", title: "Tabiiy fanlar", description: "Tabiat, hayvonlar va olam", emoji: "🌍", tint: "#dcfce7", abbr: "Tab" },
  { id: "english", title: "Ingliz tili", description: "Words, colours and numbers", emoji: "🇬🇧", tint: "#fce7f3", abbr: "Eng" },
  { id: "russian", title: "Rus tili", description: "Слова, цвета и числа", emoji: "🪆", tint: "#fef3c7", abbr: "Rus" },
  { id: "algebra", title: "Algebra", description: "Tenglamalar, funksiyalar va progressiyalar", emoji: "➗", tint: "#dbeafe", abbr: "Alg" },
  { id: "geometry", title: "Geometriya", description: "Shakllar, yuzalar va hajmlar", emoji: "📐", tint: "#e0f2fe", abbr: "Geo" },
  { id: "physics", title: "Fizika", description: "Harakat, kuch, energiya va elektr", emoji: "⚛️", tint: "#ede9fe", abbr: "Fiz" },
  { id: "chemistry", title: "Kimyo", description: "Moddalar, reaksiyalar va davriy jadval", emoji: "🧪", tint: "#dcfce7", abbr: "Kim" },
  { id: "biology", title: "Biologiya", description: "Hujayra, organizm va ekotizim", emoji: "🧬", tint: "#d1fae5", abbr: "Bio" },
  { id: "history", title: "Tarix", description: "O‘zbekiston va jahon tarixi", emoji: "🏛️", tint: "#fef3c7", abbr: "Tar" },
  { id: "geography", title: "Geografiya", description: "Xaritalar, mamlakatlar va tabiat zonalari", emoji: "🗺️", tint: "#ccfbf1", abbr: "Geg" },
  { id: "literature", title: "Adabiyot", description: "Asarlar, shoirlar va adabiy tahlil", emoji: "📚", tint: "#fce7f3", abbr: "Adb" },
  { id: "informatics", title: "Informatika", description: "Kompyuter, algoritm va dasturlash", emoji: "💻", tint: "#e0e7ff", abbr: "Inf" },
  { id: "sat-math", title: "SAT Math", description: "Algebra, ma’lumotlar tahlili va geometriya", emoji: "➕", tint: "#dbeafe", abbr: "SAT M" },
  { id: "sat-reading", title: "SAT Reading & Writing", description: "Grammatika, lug‘at va matnni tushunish", emoji: "📝", tint: "#fef3c7", abbr: "SAT R" },
];

export const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map((s) => [s.id, s])) as Record<Subject, (typeof SUBJECTS)[number]>;

export const REWARDS: Record<RewardId, { title: string; emoji: string }> = {
  cap: { title: "Kepka", emoji: "🧢" },
  clothing: { title: "Sharf", emoji: "🧣" },
  trophy: { title: "Kubok", emoji: "🏆" },
  ball: { title: "To‘p", emoji: "⚽" },
  glasses: { title: "Ko‘zoynak", emoji: "🕶️" },
  crown: { title: "Toj", emoji: "👑" },
};
