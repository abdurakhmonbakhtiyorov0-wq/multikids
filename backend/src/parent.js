import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { pool, tx } from "./db.js";
import { ApiError } from "./errors.js";
import { loc, findUserByEmail } from "./store.js";
import { mailerConfigured, sendMail } from "./mailer.js";
import { pointsPerCorrect } from "./quizEngine.js";
import { TEST_BY_ID } from "./tests.js";

// Ota-ona kabineti: rozilik, PIN, statistika, o‘chirish va parolni tiklash.

export const CONSENT_VERSION = "2026-10";
const RESET_TTL_MIN = 30;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ---------- Rozilik ----------

export async function hasConsent(userId) {
  const { rowCount } = await pool.query("SELECT 1 FROM parental_consents WHERE user_id = $1 AND version = $2", [userId, CONSENT_VERSION]);
  return rowCount > 0;
}

export async function recordConsent(userId, db = pool) {
  await db.query("INSERT INTO parental_consents (user_id, version) VALUES ($1,$2) ON CONFLICT DO NOTHING", [userId, CONSENT_VERSION]);
}

// ---------- PIN (bolalar ota-ona bo‘limiga kira olmasligi uchun) ----------

export async function pinStatus(userId) {
  const { rows } = await pool.query("SELECT parent_pin_hash IS NOT NULL AS has_pin FROM users WHERE id = $1", [userId]);
  return { hasPin: Boolean(rows[0]?.has_pin) };
}

export async function setPin(user, { pin, password }) {
  if (!(await bcrypt.compare(password, user.password_hash))) throw new ApiError(401, "Parol noto‘g‘ri");
  await pool.query("UPDATE users SET parent_pin_hash = $2, updated_at = now() WHERE id = $1", [user.id, await bcrypt.hash(pin, 10)]);
}

export async function checkPin(user, pin) {
  const { rows } = await pool.query("SELECT parent_pin_hash FROM users WHERE id = $1", [user.id]);
  if (!rows[0]?.parent_pin_hash) throw new ApiError(409, "Avval ota-ona PIN-kodini o‘rnating");
  return bcrypt.compare(pin, rows[0].parent_pin_hash);
}

// ---------- Statistika ----------

export async function overview(userId, childId, locale = "uz") {
  const { rows: ch } = await pool.query("SELECT * FROM children WHERE id = $1 AND parent_id = $2", [String(childId), userId]);
  const child = ch[0];
  if (!child) throw new ApiError(404, "Bola profili topilmadi");
  // Bitta o‘quvchining barcha sinf profillari: hisobot sinflar bo‘yicha alohida qatorlarda, lekin hammasi birga.
  const ids = (await pool.query("SELECT id FROM children WHERE person_id = $1 AND parent_id = $2", [child.person_id, userId])).rows.map((r) => r.id);

  const [history, trend, bySubject, missed, activity, totals, ach] = await Promise.all([
    pool.query(
      `SELECT id, mode, test_id, subject, grade, total, correct, accuracy, points_awarded, mark, duration_sec, created_at
         FROM results WHERE child_id = ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 20`,
      [ids],
    ),
    pool.query(
      "SELECT accuracy, created_at FROM results WHERE child_id = ANY($1::uuid[]) AND mode IN ('quiz', 'exam') ORDER BY created_at DESC LIMIT 12",
      [ids],
    ),
    pool.query(
      `SELECT subject, grade, count(*)::int AS attempts, round(avg(accuracy))::int AS avg_accuracy, sum(duration_sec)::int AS seconds, max(created_at) AS last_at
         FROM results WHERE child_id = ANY($1::uuid[]) AND mode IN ('quiz', 'exam') GROUP BY subject, grade ORDER BY grade, subject`,
      [ids],
    ),
    pool.query(
      `SELECT q.id, q.subject, q.prompt, s.attempts, s.wrong_count, s.mastered
         FROM question_stats s JOIN questions q ON q.id = s.question_id
        WHERE s.child_id = ANY($1::uuid[]) AND s.wrong_count >= 2 AND NOT s.mastered
        ORDER BY s.wrong_count DESC, s.attempts DESC LIMIT 6`,
      [ids],
    ),
    pool.query(
      `SELECT day, sum(quizzes)::int AS quizzes, sum(correct)::int AS correct, sum(duration_sec)::int AS duration_sec
         FROM daily_activity WHERE child_id = ANY($1::uuid[]) GROUP BY day ORDER BY day DESC LIMIT 30`,
      [ids],
    ),
    pool.query(
      `SELECT count(*)::int AS tests, coalesce(sum(duration_sec), 0)::int AS seconds, coalesce(sum(correct), 0)::int AS correct, coalesce(sum(total), 0)::int AS answered
         FROM results WHERE child_id = ANY($1::uuid[])`,
      [ids],
    ),
    pool.query(
      `SELECT a.id, a.title, min(ca.unlocked_at) AS unlocked_at FROM child_achievements ca JOIN achievements a ON a.id = ca.achievement_id
        WHERE ca.child_id = ANY($1::uuid[]) GROUP BY a.id, a.title ORDER BY min(ca.unlocked_at) DESC`,
      [ids],
    ),
  ]);

  const t = totals.rows[0];
  return {
    child: {
      id: child.id,
      name: child.name,
      grade: child.grade,
      subject: child.subject,
      mascot: child.mascot,
      level: child.level,
      xp: child.xp,
      balance: child.points_balance,
      streak: child.current_streak,
      bestStreak: child.best_streak,
      createdAt: child.created_at.toISOString(),
    },
    totals: {
      tests: t.tests,
      minutes: Math.round(t.seconds / 60),
      accuracy: t.answered ? Math.round((t.correct / t.answered) * 100) : null,
      activeDaysLast30: activity.rows.filter((a) => a.quizzes > 0).length,
    },
    trend: trend.rows.map((r) => r.accuracy).reverse(),
    bySubject: bySubject.rows.map((r) => ({
      subject: r.subject,
      grade: r.grade,
      attempts: r.attempts,
      avgAccuracy: r.avg_accuracy,
      minutes: Math.round(r.seconds / 60),
      lastAt: r.last_at.toISOString(),
      // Bitta urinish bilimni baholamaydi: kamida 3 ta test bo‘lgandagina "ishonchli" deymiz.
      reliable: r.attempts >= 3,
    })),
    missedQuestions: missed.rows.map((r) => ({ id: r.id, subject: r.subject, prompt: loc(r.prompt, locale), attempts: r.attempts, wrong: r.wrong_count })),
    history: history.rows.map((r) => ({
      id: r.id,
      date: r.created_at.toISOString(),
      subject: r.subject,
      grade: r.grade,
      title: TEST_BY_ID[r.test_id]?.title ?? "Xatolar ustida ishlash",
      accuracy: r.accuracy,
      correct: r.correct,
      total: r.total,
      score: r.points_awarded,
      maxScore: r.total * pointsPerCorrect(r.mode, r.test_id),
      mark: r.mark,
      minutes: Math.max(1, Math.round(r.duration_sec / 60)),
    })),
    achievements: ach.rows.map((a) => ({ id: a.id, title: loc(a.title, locale), unlockedAt: a.unlocked_at.toISOString() })),
    activity: activity.rows.map((a) => ({ day: a.day, tests: a.quizzes, minutes: Math.round(a.duration_sec / 60) })),
    notes: [
      "Natijalar faqat topshirilgan testlarga asoslanadi va bilim darajining aniq o‘lchovi emas.",
      "Vaqt testni boshlashdan tugatishgacha o‘tgan davrni ko‘rsatadi, shuning uchun taxminiy.",
    ],
  };
}

// ---------- O‘chirish ----------

export async function deleteChild(userId, childId, confirmName) {
  return tx(async (c) => {
    const { rows } = await c.query("SELECT * FROM children WHERE parent_id = $1 ORDER BY created_at, id FOR UPDATE", [userId]);
    const child = rows.find((r) => r.id === String(childId));
    if (!child) throw new ApiError(404, "Bola profili topilmadi");
    // O‘quvchi (barcha sinf profillari) soniga qaraymiz
    if (new Set(rows.map((r) => r.person_id)).size === 1) throw new ApiError(409, "Oxirgi profilni o‘chirib bo‘lmaydi. Kerak bo‘lsa, akkauntni o‘chiring.");
    if (String(confirmName ?? "").trim().toLowerCase() !== child.name.trim().toLowerCase()) throw new ApiError(400, "Tasdiqlash uchun bolaning ismini aynan kiriting");
    await c.query("DELETE FROM children WHERE person_id = $1 AND parent_id = $2", [child.person_id, userId]);
  });
}

/** Akkaunt va unga bog‘liq barcha ma’lumotlar (bolalar, natijalar, xaridlar) butunlay o‘chiriladi. */
export async function deleteAccount(user, { password, confirm }) {
  if (!(await bcrypt.compare(password, user.password_hash))) throw new ApiError(401, "Parol noto‘g‘ri");
  if (String(confirm ?? "").trim().toLowerCase() !== user.email.toLowerCase()) throw new ApiError(400, "Tasdiqlash uchun email manzilingizni aynan kiriting");
  await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
}

// ---------- Parolni tiklash ----------

export async function requestPasswordReset(email, appUrl) {
  if (!mailerConfigured()) throw new ApiError(503, "Email xizmati hozircha sozlanmagan. Parolni tiklash uchun administratorga murojaat qiling.");
  const user = await findUserByEmail(email);
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await tx(async (c) => {
      await c.query("DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL", [user.id]);
      await c.query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + make_interval(mins => $3::int))", [user.id, sha256(token), RESET_TTL_MIN]);
    });
    const link = `${appUrl}/reset?token=${token}`;
    try {
      await sendMail({
        to: user.email,
        subject: "MultiKids: parolni tiklash",
        text: `Parolni tiklash uchun havola (${RESET_TTL_MIN} daqiqa amal qiladi):\n${link}\n\nAgar siz so‘ramagan bo‘lsangiz, bu xatni e’tiborsiz qoldiring.`,
        html: `<p>Parolni tiklash uchun havola (${RESET_TTL_MIN} daqiqa amal qiladi):</p><p><a href="${link}">${link}</a></p><p>Agar siz so‘ramagan bo‘lsangiz, bu xatni e’tiborsiz qoldiring.</p>`,
      });
    } catch (err) {
      // Hisob mavjudligini oshkor qilmaslik uchun foydalanuvchiga bir xil javob beramiz, xatoni serverda yozamiz.
      console.error("Parol tiklash xati yuborilmadi:", err.message);
    }
  }
  return { ok: true };
}

export async function resetPassword(token, newPassword) {
  return tx(async (c) => {
    const { rows } = await c.query(
      "SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE",
      [sha256(String(token))],
    );
    const row = rows[0];
    if (!row) throw new ApiError(400, "Havola yaroqsiz yoki muddati tugagan. Qaytadan so‘rang.");
    await c.query("UPDATE users SET password_hash = $2, token_version = token_version + 1, updated_at = now() WHERE id = $1", [row.user_id, await bcrypt.hash(newPassword, 10)]);
    await c.query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [row.id]);
    await c.query("DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL", [row.user_id]);
  });
}
