// Rasmli savollar: rasmlar scripts/make-images.js orqali kod bilan chiziladi (frontend/public/questions/*.svg).
// Tashqi saytlardan rasm olinmaydi — ular yo‘qolib qolishi mumkin. Har bir rasmning matnli tavsifi (alt) bor.

const COLOR = { red: "#ef4444", blue: "#3b82f6", green: "#22c55e", yellow: "#facc15", purple: "#a855f7" };
export const COLOR_UZ = { red: "Qizil", blue: "Ko‘k", green: "Yashil", yellow: "Sariq", purple: "Binafsha" };
const SHAPE_UZ = { circle: "Doira", square: "Kvadrat", triangle: "Uchburchak", star: "Yulduz" };
export const ITEM_UZ = { apple: "olma", star: "yulduz", fish: "baliq", circle: "doira", triangle: "uchburchak", square: "kvadrat" };

export { COLOR };

const countSpec = (id, grade, difficulty, item, n, color) => ({
  id,
  grade,
  difficulty,
  subject: "mathematics",
  items: Array.from({ length: n }, () => ({ shape: item, color })),
  alt: `${ITEM_UZ[item][0].toUpperCase()}${ITEM_UZ[item].slice(1)}lar rasmi (savol uchun)`,
  prompt: `Rasmda nechta ${ITEM_UZ[item]} bor?`,
  correct: String(n),
  wrong: [String(n - 1), String(n + 1), String(n + 2)],
  explanation: `${ITEM_UZ[item][0].toUpperCase()}${ITEM_UZ[item].slice(1)}larni birma-bir sanasak, ${n} ta chiqadi.`,
});

const shapeSpec = (id, grade, shape, color) => {
  const others = Object.keys(SHAPE_UZ).filter((s) => s !== shape);
  return {
    id,
    grade,
    difficulty: 1,
    subject: "mathematics",
    items: [{ shape, color, big: true }],
    alt: "Geometrik shakl rasmi (savol uchun)",
    prompt: "Rasmdagi shakl qanday ataladi?",
    correct: SHAPE_UZ[shape],
    wrong: others.slice(0, 3).map((s) => SHAPE_UZ[s]),
    explanation: `Bu — ${SHAPE_UZ[shape].toLowerCase()}.`,
  };
};

const colorSpec = (id, grade, shape, color) => {
  const others = Object.keys(COLOR_UZ).filter((c) => c !== color);
  return {
    id,
    grade,
    difficulty: 1,
    subject: "mathematics",
    items: [{ shape, color, big: true }],
    alt: "Geometrik shakl rasmi (savol uchun)",
    prompt: "Rasmdagi shakl qaysi rangda?",
    correct: COLOR_UZ[color],
    wrong: others.slice(0, 3).map((c) => COLOR_UZ[c]),
    explanation: `Shakl ${COLOR_UZ[color].toLowerCase()} rangda.`,
  };
};

/** Aralash shakllar: berilgan turdagilarni sanash. */
const mixedSpec = (id, grade, difficulty, groups, ask) => {
  const items = groups.flatMap(([shape, color, n]) => Array.from({ length: n }, () => ({ shape, color })));
  const n = groups.find(([shape]) => shape === ask)[2];
  return {
    id,
    grade,
    difficulty,
    subject: "mathematics",
    items,
    alt: "Aralash shakllar rasmi (savol uchun)",
    prompt: `Rasmda nechta ${ITEM_UZ[ask]} bor?`,
    correct: String(n),
    wrong: [String(n - 1), String(n + 1), String(n + 2)].filter((x) => Number(x) >= 0),
    explanation: `Faqat ${ITEM_UZ[ask]}larni sanaymiz: ${n} ta.`,
  };
};

export const IMAGE_SPECS = [
  countSpec("img-count-apple-3", 1, 1, "apple", 3, "red"),
  countSpec("img-count-star-5", 1, 1, "star", 5, "yellow"),
  shapeSpec("img-shape-circle", 1, "circle", "red"),
  shapeSpec("img-shape-triangle", 1, "triangle", "blue"),
  shapeSpec("img-shape-square", 1, "square", "green"),
  colorSpec("img-color-yellow", 1, "square", "yellow"),
  colorSpec("img-color-purple", 1, "circle", "purple"),
  countSpec("img-count-apple-8", 1, 2, "apple", 8, "red"),
  countSpec("img-count-fish-6", 2, 1, "fish", 6, "blue"),
  countSpec("img-count-star-9", 2, 2, "star", 9, "yellow"),
  mixedSpec("img-mixed-1", 2, 2, [["circle", "red", 4], ["triangle", "blue", 3]], "triangle"),
  countSpec("img-count-apple-7", 2, 2, "apple", 7, "green"),
  mixedSpec("img-mixed-2", 3, 2, [["square", "green", 5], ["circle", "yellow", 6], ["triangle", "purple", 2]], "circle"),
  countSpec("img-count-fish-12", 3, 2, "fish", 12, "blue"),
  countSpec("img-count-star-15", 3, 3, "star", 15, "purple"),
  mixedSpec("img-mixed-3", 4, 3, [["star", "yellow", 7], ["apple", "red", 6], ["fish", "blue", 4]], "apple"),
  countSpec("img-count-fish-18", 4, 3, "fish", 18, "green"),
];
