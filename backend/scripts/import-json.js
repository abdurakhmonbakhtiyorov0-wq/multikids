// Eski data/db.json ma'lumotlarini PostgreSQL'ga ko'chiradi: npm run db:import
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pool, init, saveResult } from "../src/db.js";

const file = path.resolve(process.argv[2] || "data/db.json");
const { users = [], results = [] } = JSON.parse(fs.readFileSync(file, "utf8"));

await init();
for (const u of users) {
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, mascot, grade, subject, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
    [u.id, u.name, u.email, u.passwordHash, u.profile?.mascot ?? null, u.profile?.grade ?? null, u.profile?.subject ?? null, u.createdAt],
  );
}
for (const r of results) await saveResult(r);
console.log(`Ko'chirildi: ${users.length} foydalanuvchi, ${results.length} natija`);
await pool.end();
