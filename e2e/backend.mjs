// E2E uchun: vaqtinchalik PostgreSQL + backend (4000) + sinov "oracle" serveri (4001).
// Oracle — faqat testlar uchun: savol matnidan to‘g‘ri javob matnini qaytaradi (brauzer to‘g‘ri javobni bilmaydi).
import http from "node:http";

const { startTestDb } = await import("../backend/test-support/db.js");
const db = await startTestDb();
const { default: app } = await import("../backend/src/server.js");

app.listen(4000, () => console.log("E2E backend: http://localhost:4000"));

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    try {
      if (url.pathname === "/answer") {
        const { rows } = await db.pool.query(
          `SELECT options->'uz'->>correct_index AS correct FROM questions
            WHERE prompt->>'uz' = $1 AND grade = $2 AND subject = $3 AND ($4::text IS NULL OR image_path = $4)`,
          [url.searchParams.get("prompt"), Number(url.searchParams.get("grade")), url.searchParams.get("subject"), url.searchParams.get("img")],
        );
        res.end(JSON.stringify({ correct: rows.map((r) => r.correct) }));
      } else res.end("{}");
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(e) }));
    }
  })
  .listen(4001, () => console.log("E2E oracle: http://localhost:4001"));

const stop = async () => {
  await db.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
