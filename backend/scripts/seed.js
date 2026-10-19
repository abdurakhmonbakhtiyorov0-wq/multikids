// Savollar bankini bazaga yuklaydi (qayta ishga tushirish xavfsiz): npm run db:seed
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";
import { allBanks } from "../src/questions/index.js";
import { generatedMathQuestions } from "../src/questions/generated-math.js";

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
  return [...fixed, ...generatedMathQuestions()];
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
      `INSERT INTO questions (id, subject, grade, topic, difficulty, prompt, options, correct_index, explanation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET topic = EXCLUDED.topic, difficulty = EXCLUDED.difficulty, prompt = EXCLUDED.prompt,
         options = EXCLUDED.options, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation`,
      [q.id, q.subject, q.grade, q.topic, q.difficulty, { uz: q.prompt }, { uz: q.options }, q.correctIndex, { uz: q.explanation }],
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
