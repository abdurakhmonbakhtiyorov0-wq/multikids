import { pool } from "./db.js";
import { ApiError } from "./errors.js";

// Urinishlar cheklovi bazada saqlanadi: Vercel'da har bir so‘rov boshqa nusxada ishlashi mumkin.
// Oyna tugagach hisoblagich qayta boshlanadi. Qiymat qaytaradi: hozirgi oynadagi urinishlar soni.
export async function hit(key, windowSec) {
  const { rows } = await pool.query(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2::int) THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2::int) THEN now() ELSE rate_limits.window_start END
     RETURNING count`,
    [key, windowSec],
  );
  if (Math.random() < 0.01) pool.query("DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'").catch(() => {});
  return rows[0].count;
}

/** Cheklovdan oshsa 429 beradi. */
export async function limit(key, max, windowSec, message = "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.") {
  if ((await hit(key, windowSec)) > max) throw new ApiError(429, message);
}

/** Muvaffaqiyatli kirishdan keyin hisoblagichni tozalash. */
export const reset = (key) => pool.query("DELETE FROM rate_limits WHERE key = $1", [key]);
