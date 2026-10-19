import { loc } from "./store.js";
import { levelForXp } from "./quizEngine.js";

// Ball, XP va yutuqlarni bir joyda, idempotent tarzda berish. Hammasi chaqiruvchining tranzaksiyasi ichida ishlaydi.

/**
 * Daftarga (point_ledger) yozadi; (child, reason, ref_id) takrorlansa hech narsa o‘zgarmaydi.
 * Bola qatori chaqiruvchi tomonidan FOR UPDATE bilan bloklangan bo‘lishi kerak.
 */
export async function grantPoints(c, childId, { points = 0, xp = 0, reason, refId }) {
  const ins = await c.query(
    "INSERT INTO point_ledger (child_id, points, xp, reason, ref_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id",
    [childId, points, xp, reason, refId],
  );
  if (!ins.rowCount) return { granted: false };
  const { rows } = await c.query(
    "UPDATE children SET points_balance = points_balance + $2, xp = xp + $3, updated_at = now() WHERE id = $1 RETURNING xp, points_balance",
    [childId, points, xp],
  );
  const level = levelForXp(rows[0].xp);
  await c.query("UPDATE children SET level = $2 WHERE id = $1 AND level <> $2", [childId, level]);
  return { granted: true, level, balance: rows[0].points_balance, xp: rows[0].xp };
}

/** Yutuqni bir marta beradi (va mukofot ballini). Allaqachon bo‘lsa null qaytaradi. */
export async function awardAchievement(c, childId, achievementId, locale = "uz") {
  const ins = await c.query("INSERT INTO child_achievements (child_id, achievement_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING achievement_id", [childId, achievementId]);
  if (!ins.rowCount) return null;
  const { rows } = await c.query("SELECT id, title, description, reward_points FROM achievements WHERE id = $1", [achievementId]);
  const a = rows[0];
  if (!a) return null;
  if (a.reward_points) await grantPoints(c, childId, { points: a.reward_points, reason: "achievement", refId: a.id });
  return { id: a.id, title: loc(a.title, locale), description: loc(a.description, locale), rewardPoints: a.reward_points };
}
