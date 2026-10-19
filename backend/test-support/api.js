// Testlar uchun umumiy yordamchilar: server ishga tushirish, HTTP chaqiruvlar, test yechish.
import assert from "node:assert/strict";
import { startTestDb } from "./db.js";

export async function boot() {
  const db = await startTestDb();
  const { arrangeOptions } = await import("../src/quizEngine.js");
  const { loc } = await import("../src/store.js");
  const { default: app } = await import("../src/server.js");
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  let n = 0;

  async function call(method, path, { token, body, child } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(child ? { "X-Child-Id": child } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }

  async function signup(prefix = "user", profile = { grade: 1, subject: "mathematics", mascot: "pandacha" }) {
    const email = `${prefix}${++n}@example.com`;
    const r = await call("POST", "/api/auth/register", { body: { name: "Ali", email, password: "secret123", consent: true } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const token = r.body.token;
    if (profile) await call("PATCH", "/api/me", { token, body: profile });
    return { token, email, user: r.body.user };
  }

  const start = (token, body = { grade: 1, subject: "mathematics" }, child) => call("POST", "/api/quiz/start", { token, body, child });

  /** To‘g‘ri variant indeksi (mijoz bilmaydi, testda bazadan olinadi). */
  async function correctIndexFor(sessionId, question) {
    const { rows } = await db.pool.query("SELECT * FROM questions WHERE id = $1", [question.id]);
    return arrangeOptions(sessionId, question.id, loc(rows[0].options, "uz"), rows[0].correct_index).correctIndex;
  }

  /** Testni oxirigacha yechadi; wrongAt dagi indekslarga ataylab xato javob beradi. */
  async function playAll(token, session, { wrongAt = [], child } = {}) {
    let q = session.question;
    let i = session.index;
    const difficulties = [];
    const ids = [];
    while (q) {
      const right = await correctIndexFor(session.sessionId, q);
      const answer = wrongAt.includes(i) ? (right + 1) % q.options.length : right;
      difficulties.push(q.difficulty);
      ids.push(q.id);
      const r = await call("POST", `/api/quiz/${session.sessionId}/answer`, { token, child, body: { index: i, answer } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      q = r.body.next;
      i++;
    }
    return { difficulties, ids };
  }

  async function finish(token, session, opts = {}) {
    const r = await call("POST", `/api/quiz/${session.sessionId}/finish`, { token, child: opts.child });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  }

  return {
    db, call, signup, start, playAll, finish, correctIndexFor, arrangeOptions, loc,
    async stop() {
      server.close();
      await db.stop();
    },
  };
}
