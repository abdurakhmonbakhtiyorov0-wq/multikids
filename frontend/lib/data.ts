export type Grade = 1 | 2 | 3 | 4;
export type Subject = "mathematics" | "native-language" | "reading" | "natural-science" | "english" | "russian";
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
  | "kuchukcha";
export type RewardId = "cap" | "clothing" | "trophy" | "ball" | "glasses" | "crown";

export type EarStyle = "round" | "pointy" | "floppy" | "bunny" | "none";
export type Extra = "dragon" | "panda" | "labubu" | "cat" | "robot" | "bear" | "minion" | "spider" | "mario" | "dog";

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
];

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c])) as Record<MascotId, Character>;

export const GRADES: { id: Grade; title: string; note: string; emoji: string }[] = [
  { id: 1, title: "1-sinf", note: "Harflar, sonlar va birinchi kashfiyotlar", emoji: "🌱" },
  { id: 2, title: "2-sinf", note: "Ko‘paytirish va yangi so‘zlar", emoji: "🌿" },
  { id: 3, title: "3-sinf", note: "Murakkabroq masalalar va matnlar", emoji: "🌳" },
  { id: 4, title: "4-sinf", note: "Kasrlar, adabiyot va tabiat sirlari", emoji: "🏔️" },
];

export const SUBJECTS: { id: Subject; title: string; description: string; emoji: string; tint: string }[] = [
  { id: "mathematics", title: "Matematika", description: "Sonlar, misollar va masalalar", emoji: "🔢", tint: "#dbeafe" },
  { id: "native-language", title: "Ona tili", description: "Harflar, so‘zlar va gaplar", emoji: "✍️", tint: "#e0f2fe" },
  { id: "reading", title: "O‘qish", description: "Ertaklar, she’rlar va matnlar", emoji: "📖", tint: "#e0e7ff" },
  { id: "natural-science", title: "Tabiiy fanlar", description: "Tabiat, hayvonlar va olam", emoji: "🌍", tint: "#dcfce7" },
  { id: "english", title: "Ingliz tili", description: "Words, colours and numbers", emoji: "🇬🇧", tint: "#fce7f3" },
  { id: "russian", title: "Rus tili", description: "Слова, цвета и числа", emoji: "🪆", tint: "#fef3c7" },
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
