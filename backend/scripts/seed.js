// Savollar bankini bazaga yuklaydi (qayta ishga tushirish xavfsiz): npm run db:seed
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";
import { allBanks } from "../src/questions/index.js";
import { generatedMathQuestions } from "../src/questions/generated-math.js";
import { IMAGE_SPECS } from "../src/questions/images.js";

const LEVEL = { easy: 1, medium: 2, hard: 3 };

export function collectQuestions() {
  const fixed = Object.values(allBanks())
    .flat()
    .map((q) => ({
      id: q.id,
      grade: q.grade,
      subject: q.subject,
      topic: "general",
      difficulty: LEVEL[q.difficulty],
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctAnswerIndex,
      explanation: q.explanation,
    }));
  const images = IMAGE_SPECS.map((q) => ({
    id: q.id,
    grade: q.grade,
    subject: q.subject,
    topic: "visual",
    difficulty: q.difficulty,
    prompt: q.prompt,
    options: [q.correct, ...q.wrong],
    correctIndex: 0,
    explanation: q.explanation,
    kind: "image",
    imagePath: `/questions/${q.id}.svg`,
    imageAlt: q.alt,
  }));
  return [...fixed, ...generatedMathQuestions(), ...images];
}

export function validateQuestion(q) {
  if (new Set(q.options).size !== q.options.length) return "takroriy variant";
  if (q.options.length < 3 || q.options.length > 6) return "variantlar soni noto‘g‘ri";
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) return "to‘g‘ri javob indeksi noto‘g‘ri";
  if (![1, 2, 3].includes(q.difficulty)) return "qiyinlik noto‘g‘ri";
  return null;
}

export async function seed(log = console.log) {
  const questions = collectQuestions();
  const ids = new Set();
  for (const q of questions) {
    const bad = validateQuestion(q);
    if (bad) throw new Error(`Savol ${q.id}: ${bad}`);
    if (ids.has(q.id)) throw new Error(`Takroriy ID: ${q.id}`);
    ids.add(q.id);
  }
  for (const q of questions) {
    await pool.query(
      `INSERT INTO questions (id, subject, grade, topic, difficulty, prompt, options, correct_index, explanation, kind, image_path, image_alt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET topic = EXCLUDED.topic, difficulty = EXCLUDED.difficulty, prompt = EXCLUDED.prompt,
         options = EXCLUDED.options, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation,
         kind = EXCLUDED.kind, image_path = EXCLUDED.image_path, image_alt = EXCLUDED.image_alt`,
      [q.id, q.subject, q.grade, q.topic, q.difficulty, { uz: q.prompt }, { uz: q.options }, q.correctIndex, { uz: q.explanation }, q.kind ?? "text", q.imagePath ?? null, q.imageAlt ? { uz: q.imageAlt } : null],
    );
  }
  log(`Savollar yuklandi: ${questions.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await seed();
  } catch (err) {
    console.error("Seed xatosi:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
