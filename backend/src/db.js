import pg from "pg";

// DATE ustunlari "YYYY-MM-DD" satri bo‘lib qoladi (vaqt mintaqasi bilan siljimasligi uchun).
pg.types.setTypeParser(1082, (v) => v);

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

// Ulanish va sxema mavjudligini tekshiradi (sxemani `npm run db:migrate` yaratadi).
let ready;
export function init() {
  ready ??= (async () => {
    const { rows } = await pool.query("SELECT to_regclass('public.schema_migrations') AS t");
    if (!rows[0].t) throw new Error("Baza sxemasi yo‘q. `npm run db:migrate` ni ishga tushiring.");
  })().catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}

/** Tranzaksiya: xato bo‘lsa ROLLBACK, aks holda COMMIT. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

