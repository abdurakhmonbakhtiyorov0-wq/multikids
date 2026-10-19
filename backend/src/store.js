import crypto from "node:crypto";
import { pool, tx } from "./db.js";
import { ApiError } from "./errors.js";
import { MAX_CHILDREN, levelBounds, levelTitle } from "./quizEngine.js";

// Bola qatori + kiyilgan buyumlar ro‘yxati.
const CHILD_SELECT = `SELECT c.*, coalesce((SELECT array_agg(ci.item_id ORDER BY ci.item_id) FROM child_items ci WHERE ci.child_id = c.id AND ci.equipped), '{}') AS equipped_items FROM children c`;

// Foydalanuvchi (ota-ona) va bola profillari bilan ishlash.

export const loc = (value, locale = "uz") => {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  return value[locale] ?? value.uz ?? value.ru ?? Object.values(value)[0];
};

export async function findUserById(id) {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
}

export async function findUserByEmail(email) {
  const { rows } = await pool.query("SELECT * FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL", [email]);
  return rows[0] ?? null;
}

/** Akkaunt + birinchi bola profili (bitta tranzaksiyada). Email band bo‘lsa null. */
export async function createAccount({ name, email, passwordHash }) {
  return tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
       ON CONFLICT (lower(email)) WHERE deleted_at IS NULL DO NOTHING RETURNING *`,
      [email, passwordHash, name],
    );
    if (!rows[0]) return null;
    await c.query("INSERT INTO children (id, parent_id, name) VALUES ($1, $2, $3)", [crypto.randomUUID(), rows[0].id, name]);
    return rows[0];
  });
}

export async function listChildren(userId) {
  const { rows } = await pool.query("SELECT * FROM children WHERE parent_id = $1 ORDER BY created_at, id", [userId]);
  return rows;
}

/**
 * Faol bola: X-Child-Id ko‘rsatilgan bo‘lsa — aynan shu (faqat shu ota-onaniki bo‘lsa), aks holda eng birinchisi.
 * Boshqa ota-onaning bolasi ID sini yuborish 404 qaytaradi.
 */
export async function resolveChild(userId, childId) {
  if (childId) {
    if (!/^[0-9a-f-]{36}$/i.test(childId)) throw new ApiError(404, "Bola profili topilmadi");
    const { rows } = await pool.query(`${CHILD_SELECT} WHERE c.id = $1 AND c.parent_id = $2`, [childId, userId]);
    if (!rows[0]) throw new ApiError(404, "Bola profili topilmadi");
    return rows[0];
  }
  const { rows } = await pool.query(`${CHILD_SELECT} WHERE c.parent_id = $1 ORDER BY c.created_at, c.id LIMIT 1`, [userId]);
  if (!rows[0]) throw new ApiError(404, "Bola profili topilmadi");
  return rows[0];
}

export async function createChild(userId, { name, grade, mascot }) {
  return tx(async (c) => {
    await c.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]); // parallel yaratishda limitni buzmaslik uchun
    const { rows: cnt } = await c.query("SELECT count(*)::int AS n FROM children WHERE parent_id = $1", [userId]);
    if (cnt[0].n >= MAX_CHILDREN) throw new ApiError(409, `Profillar soni ${MAX_CHILDREN} tadan oshmasligi kerak`);
    const { rows } = await c.query(
      "INSERT INTO children (parent_id, name, grade, mascot) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, name, grade ?? null, mascot ?? null],
    );
    return rows[0];
  });
}

export async function updateChild(childId, { name, mascot, grade, subject, locale, soundEnabled, voiceAutoplay, timezone }) {
  const { rows } = await pool.query(
    `UPDATE children SET
       name = COALESCE($2, name), mascot = COALESCE($3, mascot), grade = COALESCE($4, grade), subject = COALESCE($5, subject),
       locale = COALESCE($6, locale), sound_enabled = COALESCE($7, sound_enabled), voice_autoplay = COALESCE($8, voice_autoplay),
       timezone = COALESCE($9, timezone), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [childId, name ?? null, mascot ?? null, grade ?? null, subject ?? null, locale ?? null, soundEnabled ?? null, voiceAutoplay ?? null, timezone ?? null],
  );
  return rows[0];
}

/** Frontend kutgan shakl: profil faol bolaning ma‘lumotlaridan olinadi. */
export function publicUser(user, child) {
  const [floor, ceil] = levelBounds(child.level);
  return {
    id: user.id,
    name: child.name,
    email: user.email,
    profile: { mascot: child.mascot, grade: child.grade, subject: child.subject },
    createdAt: user.created_at.toISOString(),
    child: {
      id: child.id,
      locale: child.locale,
      soundEnabled: child.sound_enabled,
      voiceAutoplay: child.voice_autoplay,
      timezone: child.timezone,
      balance: child.points_balance,
      xp: child.xp,
      level: child.level,
      levelTitle: levelTitle(child.level),
      equipped: child.equipped_items ?? [],
      levelFloorXp: floor,
      levelCeilXp: ceil,
      streak: child.current_streak,
      bestStreak: child.best_streak,
    },
  };
}
