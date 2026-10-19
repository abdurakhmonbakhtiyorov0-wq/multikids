import pg from "pg";

// PostgreSQL ulanishi. DATABASE_URL (masalan Neon/Supabase/Render) yoki PGHOST/PGUSER/... o‘zgaruvchilari.
// pgAdmin orqali ham xuddi shu bazaga ulanib, jadvallarni ko‘rish mumkin.
const useUrl = Boolean(process.env.DATABASE_URL);
const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;

export const pool = new pg.Pool(
  useUrl
    ? { connectionString: process.env.DATABASE_URL, ssl, max: Number(process.env.PG_POOL_MAX) || 10 }
    : {
        host: process.env.PGHOST || "localhost",
        port: Number(process.env.PGPORT) || 5432,
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE || "multikids",
        ssl,
        max: Number(process.env.PG_POOL_MAX) || 10,
      },
);

pool.on("error", (err) => console.error("PostgreSQL pool xatosi:", err.message));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  mascot        TEXT,
  grade         SMALLINT,
  subject       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS results (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grade        SMALLINT NOT NULL,
  subject      TEXT NOT NULL,
  total        INTEGER NOT NULL,
  correct      INTEGER NOT NULL,
  incorrect    INTEGER NOT NULL,
  score        INTEGER NOT NULL,
  max_score    INTEGER NOT NULL,
  accuracy     INTEGER NOT NULL,
  best_streak  INTEGER NOT NULL,
  equipped     TEXT[] NOT NULL DEFAULT '{}',
  earned       TEXT[] NOT NULL DEFAULT '{}',
  duration_sec INTEGER NOT NULL,
  answers      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS results_user_idx ON results (user_id, created_at);
`;

let ready;
export function init() {
  ready ??= pool.query(SCHEMA).catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}

// --- Qatorlarni API shakliga (camelCase) o‘tkazish ---
const userFromRow = (r) =>
  r && {
    id: r.id,
    name: r.name,
    email: r.email,
    passwordHash: r.password_hash,
    profile: { mascot: r.mascot, grade: r.grade, subject: r.subject },
    createdAt: r.created_at.toISOString(),
  };

const resultFromRow = (r) =>
  r && {
    id: r.id,
    userId: r.user_id,
    grade: r.grade,
    subject: r.subject,
    total: r.total,
    correct: r.correct,
    incorrect: r.incorrect,
    score: r.score,
    maxScore: r.max_score,
    accuracy: r.accuracy,
    bestStreak: r.best_streak,
    equipped: r.equipped,
    earned: r.earned,
    durationSec: r.duration_sec,
    createdAt: r.created_at.toISOString(),
    answers: r.answers,
  };

// --- Foydalanuvchilar ---
export async function findUserById(id) {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return userFromRow(rows[0]);
}

export async function findUserByEmail(email) {
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return userFromRow(rows[0]);
}

// Email band bo‘lsa null qaytaradi (UNIQUE cheklovi poyga holatidan ham himoya qiladi).
export async function createUser({ id, name, email, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING RETURNING *`,
    [id, name, email, passwordHash],
  );
  return userFromRow(rows[0]) ?? null;
}

export async function updateUserProfile(id, { name, mascot, grade, subject }) {
  const { rows } = await pool.query(
    `UPDATE users SET
       name    = COALESCE($2, name),
       mascot  = COALESCE($3, mascot),
       grade   = COALESCE($4, grade),
       subject = COALESCE($5, subject)
     WHERE id = $1 RETURNING *`,
    [id, name ?? null, mascot ?? null, grade ?? null, subject ?? null],
  );
  return userFromRow(rows[0]);
}

// --- Natijalar ---
export async function saveResult(r) {
  await pool.query(
    `INSERT INTO results (id, user_id, grade, subject, total, correct, incorrect, score, max_score,
                          accuracy, best_streak, equipped, earned, duration_sec, answers, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (id) DO NOTHING`,
    [
      r.id, r.userId, r.grade, r.subject, r.total, r.correct, r.incorrect, r.score, r.maxScore,
      r.accuracy, r.bestStreak, r.equipped, r.earned, r.durationSec, JSON.stringify(r.answers), r.createdAt,
    ],
  );
}

export async function findResult(id, userId) {
  const { rows } = await pool.query("SELECT * FROM results WHERE id = $1 AND user_id = $2", [id, userId]);
  return resultFromRow(rows[0]);
}

// Eskidan yangiga tartibda (progress hisoblash uchun).
export async function listResults(userId) {
  const { rows } = await pool.query("SELECT * FROM results WHERE user_id = $1 ORDER BY created_at ASC", [userId]);
  return rows.map(resultFromRow);
}
