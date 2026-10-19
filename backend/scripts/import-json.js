// Eski data/db.json (JSON-fayl ombori) ma‘lumotlarini PostgreSQL'ga ko‘chiradi: npm run db:import [fayl]
// Avval `npm run db:migrate` va `npm run db:seed` bajarilgan bo‘lishi kerak. Qayta ishga tushirish xavfsiz.
// Eski foydalanuvchi = ota-ona akkaunti + bitta bola profili (bir xil ID). Variantlar tartibi saqlanmagan,
// shuning uchun eski javoblar uchun faqat to‘g‘ri/noto‘g‘ri belgisi ko‘chiriladi.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, tx } from "../src/db.js";
import { levelForXp, COMPLETION_XP } from "../src/quizEngine.js";

export async function importJson(file, log = console.log) {
  const { users = [], results = [] } = JSON.parse(fs.readFileSync(file, "utf8"));
  const known = new Set((await pool.query("SELECT id FROM questions")).rows.map((r) => r.id));
  let imported = 0;

  await tx(async (c) => {
    for (const u of users) {
      await c.query(
        "INSERT INTO users (id, email, password_hash, name, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        [u.id, u.email, u.passwordHash, u.name, u.createdAt],
      );
      await c.query(
        "INSERT INTO children (id, parent_id, name, grade, mascot, subject, created_at) VALUES ($1,$1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
        [u.id, u.name, u.profile?.grade ?? null, u.profile?.mascot ?? null, u.profile?.subject ?? null, u.createdAt],
      );
    }
    for (const r of results) {
      const answers = (r.answers ?? []).filter((a) => known.has(a.questionId));
      await c.query(
        `INSERT INTO quiz_sessions (id, child_id, mode, grade, subject, status, total, current_index, question_ids, started_at, finished_at, expires_at)
         VALUES ($1,$2,'quiz',$3,$4,'finished',$5,$5,$6,$7,$7,$7) ON CONFLICT DO NOTHING`,
        [r.id, r.userId, r.grade, r.subject, r.total, answers.map((a) => a.questionId), r.createdAt],
      );
      for (const [i, a] of answers.entries()) {
        await c.query(
          "INSERT INTO quiz_answers (session_id, position, question_id, child_id, chosen_index, is_correct) VALUES ($1,$2,$3,$4,NULL,$5) ON CONFLICT DO NOTHING",
          [r.id, i, a.questionId, r.userId, a.chosen === a.correctIndex],
        );
      }
      const ins = await c.query(
        `INSERT INTO results (id, session_id, child_id, mode, grade, subject, total, correct, incorrect, accuracy, best_streak, points_awarded, xp_awarded, duration_sec, created_at)
         VALUES ($1,$1,$2,'quiz',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING RETURNING id`,
        [r.id, r.userId, r.grade, r.subject, r.total, r.correct, r.incorrect, r.accuracy, r.bestStreak, r.score, r.score + COMPLETION_XP, r.durationSec, r.createdAt],
      );
      if (!ins.rowCount) continue;
      imported++;
      await c.query("INSERT INTO point_ledger (child_id, points, xp, reason, ref_id) VALUES ($1,$2,$3,'quiz',$4) ON CONFLICT DO NOTHING", [r.userId, r.score, r.score + COMPLETION_XP, r.id]);
    }
    for (const u of users) {
      const { rows } = await c.query("SELECT coalesce(sum(points),0)::int AS p, coalesce(sum(xp),0)::int AS x FROM point_ledger WHERE child_id = $1", [u.id]);
      await c.query("UPDATE children SET points_balance = $2, xp = $3, level = $4 WHERE id = $1", [u.id, rows[0].p, rows[0].x, levelForXp(rows[0].x)]);
    }
  });
  log(`Ko‘chirildi: ${users.length} foydalanuvchi, ${imported} yangi natija`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await importJson(path.resolve(process.argv[2] || "data/db.json"));
  } catch (err) {
    console.error("Import xatosi:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
