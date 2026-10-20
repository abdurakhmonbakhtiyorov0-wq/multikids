import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { boot } from "../test-support/api.js";

// src/ modullari bazaga ulanadi, shuning uchun test bazasi (boot) ishga tushgandan keyin dinamik import qilinadi.
let leaksAnswer;

// Gemini so‘rovlari soxta javob bilan almashtiriladi; boshqa so‘rovlar (test serveriga) o‘z holicha o‘tadi.
const realFetch = globalThis.fetch;
let geminiCalls = [];
let geminiReply = () => "Avval savolda nima so‘ralayotganini aniqlang va ma’lum sonlarni yozib chiqing.";
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://generativelanguage.googleapis.com/")) {
    geminiCalls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: geminiReply(geminiCalls.at(-1)) }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return realFetch(url, init);
};

let t;
before(async () => {
  t = await boot();
  ({ leaksAnswer } = await import("../src/hints.js"));
});
after(async () => {
  delete process.env.GEMINI_API_KEY;
  globalThis.fetch = realFetch;
  await t?.stop();
});

const hint = (token, sessionId, index, child) => t.call("POST", `/api/quiz/${sessionId}/hint`, { token, child, body: { index } });

test("kalit berilmasa maslahat o‘chiq: tugma yo‘q (features.hints=false), so‘rov 503", async () => {
  delete process.env.GEMINI_API_KEY;
  const { token, user } = await t.signup("hintoff");
  assert.equal(user.features.hints, false);
  const s = (await t.start(token)).body;
  const r = await hint(token, s.sessionId, 0);
  assert.equal(r.status, 503);
  assert.equal(geminiCalls.length, 0);
});

test("kalit bilan: maslahat qaytadi; modelga faqat savol va variantlar ketadi (javob, izoh, ism, email yo‘q)", async () => {
  process.env.GEMINI_API_KEY = "test-key-not-real";
  const { token, user, email } = await t.signup("hinton");
  assert.equal((await t.call("GET", "/api/me", { token })).body.user.features.hints, true);
  const s = (await t.start(token)).body;
  const r = await hint(token, s.sessionId, 0);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.hint, /savolda/);

  const call = geminiCalls.at(-1);
  assert.equal(call.headers["x-goog-api-key"], "test-key-not-real");
  assert.ok(!call.url.includes("test-key-not-real"), "kalit manzilga yozilmaydi");
  const sent = JSON.stringify(call.body);
  const { rows } = await t.db.pool.query("SELECT explanation, correct_index, options FROM questions WHERE id = $1", [s.question.id]);
  const explanation = rows[0].explanation.uz;
  assert.ok(explanation && !sent.includes(explanation), "izoh modelga yuborilmaydi");
  assert.ok(sent.includes(s.question.prompt), "savol matni yuboriladi");
  assert.ok(!sent.includes(email) && !sent.includes(user.name), "shaxsiy ma’lumot yuborilmaydi");
  assert.match(sent, /Never say which option is correct/);
});

test("maslahatda to‘g‘ri javob uchrasa, u umumiy ishoraga almashtiriladi", async () => {
  process.env.GEMINI_API_KEY = "test-key-not-real";
  const { token } = await t.signup("hintleak");
  const s = (await t.start(token)).body;
  const { rows } = await t.db.pool.query("SELECT options, correct_index FROM questions WHERE id = $1", [s.question.id]);
  const correct = rows[0].options.uz[rows[0].correct_index];
  geminiReply = () => `Javob ${correct} bo‘ladi.`;
  const r = await hint(token, s.sessionId, 0);
  assert.equal(r.status, 200);
  assert.ok(!leaksAnswer(r.body.hint, correct), "oshkor javob o‘tib ketmadi");
  assert.match(r.body.hint, /qayta o‘qing/);
  geminiReply = () => "Avval savolda nima so‘ralayotganini aniqlang.";
});

test("cheklovlar: bitta savolga 2 ta maslahat, javob berilgan yoki boshqa savol, imtihon va begona sessiya uchun rad", async () => {
  process.env.GEMINI_API_KEY = "test-key-not-real";
  const a = await t.signup("hintlim");
  const s = (await t.start(a.token)).body;
  assert.equal((await hint(a.token, s.sessionId, 0)).status, 200);
  assert.equal((await hint(a.token, s.sessionId, 0)).status, 200);
  assert.equal((await hint(a.token, s.sessionId, 0)).status, 429, "uchinchi maslahat rad etiladi");
  assert.equal((await hint(a.token, s.sessionId, 1)).status, 409, "faqat joriy savol uchun");

  // Javob berilgach — maslahat yo‘q
  const b = await t.signup("hintans");
  const s2 = (await t.start(b.token)).body;
  await t.call("POST", `/api/quiz/${s2.sessionId}/answer`, { token: b.token, body: { index: 0, answer: 0 } });
  assert.equal((await hint(b.token, s2.sessionId, 0)).status, 409);

  // Boshqa foydalanuvchi sessiyasi
  assert.equal((await hint(b.token, s.sessionId, 0)).status, 404);

  // Imtihon rejimi
  const c = await t.signup("hintexam");
  const ex = (await t.start(c.token, { grade: 1, subject: "mathematics", testId: "exam" })).body;
  assert.equal((await hint(c.token, ex.sessionId, 0)).status, 403);
});

test("kunlik limit: oshganda 429", async () => {
  process.env.GEMINI_API_KEY = "test-key-not-real";
  process.env.HINT_DAILY_LIMIT = "1";
  const { token } = await t.signup("hintday");
  const s = (await t.start(token)).body;
  assert.equal((await hint(token, s.sessionId, 0)).status, 200);
  const r = await hint(token, s.sessionId, 0);
  assert.equal(r.status, 429);
  assert.match(r.body.error, /Bugungi/);
  delete process.env.HINT_DAILY_LIMIT;
});

test("leaksAnswer: variant matni alohida so‘z/son sifatida uchrasa — oshkor", () => {
  assert.equal(leaksAnswer("Javob 12 ga teng", "12"), true);
  assert.equal(leaksAnswer("Sonlar 112 va 120", "12"), false);
  assert.equal(leaksAnswer("Bu Toshkent shahri", "Toshkent"), true);
  assert.equal(leaksAnswer("Avval savolni o‘qing", "Nil"), false);
});
