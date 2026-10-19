// Migratsiyalarni tartib bilan bajaradi: npm run db:migrate
// Har bir .sql fayl o‘zini schema_migrations jadvaliga yozadi; bajarilganlari o‘tkazib yuboriladi.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function migrate(log = console.log) {
  const { rows } = await pool.query("SELECT to_regclass('public.schema_migrations') AS t");
  const applied = new Set();
  if (rows[0].t) {
    for (const r of (await pool.query("SELECT version FROM schema_migrations")).rows) applied.add(r.version);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;
    log(`Bajarilmoqda: ${file}`);
    await pool.query(fs.readFileSync(path.join(dir, file), "utf8"));
  }
  log("Migratsiyalar tayyor.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await migrate();
  } catch (err) {
    console.error("Migratsiya xatosi:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
