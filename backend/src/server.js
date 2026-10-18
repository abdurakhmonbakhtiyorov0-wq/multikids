import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db, load, save, DATA_DIR } from "./db.js";
import { getQuestionBank, SUBJECTS, GRADES } from "./questions/index.js";
import { createSession, answerQuestion, summarize, publicState, QUIZ_LENGTH } from "./quizEngine.js";

load();

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || "http://localhost:3000,https://multikids-two.vercel.app").split(",").map((s) => s.trim());
const MASCOTS = ["ajdarcha", "pandacha", "labubu", "mushukcha", "robotcha", "ayiqcha", "minioncha", "spidermancha", "mariocha", "kuchukcha"];

function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, ".jwt-secret");
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString("hex"));
  console.warn("JWT_SECRET o‘rnatilmagan — data/.jwt-secret faylidagi lokal kalit ishlatilmoqda.");
  return fs.readFileSync(file, "utf8");
}
const SECRET = jwtSecret();

const app = express();
// Token Authorization sarlavhasida yuboriladi (cookie emas), shuning uchun loyiha domenlarini ruxsat etish xavfsiz.
const VERCEL_ORIGIN = /^https:\/\/multikids[\w-]*\.vercel\.app$/;
app.use(cors({ origin: (origin, cb) => cb(null, !origin || CLIENT_ORIGIN.includes(origin) || VERCEL_ORIGIN.test(origin)) }));
app.use(express.json({ limit: "50kb" }));

// --- Yordamchilar ---
const fail = (res, status, message) => res.status(status).json({ error: message });

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, profile: u.profile, createdAt: u.createdAt };
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) return fail(res, 401, "Tizimga kiring");
  try {
    const { sub } = jwt.verify(token, SECRET);
    const user = db.users.find((u) => u.id === sub);
    if (!user) return fail(res, 401, "Foydalanuvchi topilmadi");
    req.user = user;
    next();
  } catch {
    fail(res, 401, "Sessiya muddati tugagan, qaytadan kiring");
  }
}

// Oddiy kirish urinishlari cheklovchisi (IP bo'yicha, 15 daqiqada 20 ta).
const attempts = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const rec = attempts.get(req.ip) ?? { count: 0, reset: now + 15 * 60_000 };
  if (now > rec.reset) Object.assign(rec, { count: 0, reset: now + 15 * 60_000 });
  rec.count++;
  attempts.set(req.ip, rec);
  if (rec.count > 20) return fail(res, 429, "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.");
  next();
}

const sign = (u) => jwt.sign({ sub: u.id }, SECRET, { expiresIn: "7d" });

// --- Auth ---
const registerSchema = z.object({
  name: z.string().trim().min(2, "Ism kamida 2 harfdan iborat bo‘lsin").max(30, "Ism juda uzun"),
  email: z.string().trim().toLowerCase().email("Email manzil noto‘g‘ri"),
  password: z.string().min(6, "Parol kamida 6 belgidan iborat bo‘lsin").max(100),
});

app.post("/api/auth/register", rateLimit, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
  const { name, email, password } = parsed.data;
  if (db.users.some((u) => u.email === email)) return fail(res, 409, "Bu email bilan hisob allaqachon mavjud");
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    profile: { mascot: null, grade: null, subject: null },
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await save();
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email("Email manzil noto‘g‘ri"), password: z.string().min(1, "Parolni kiriting") });

app.post("/api/auth/login", rateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
  const user = db.users.find((u) => u.email === parsed.data.email);
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return fail(res, 401, "Email yoki parol noto‘g‘ri");
  res.json({ token: sign(user), user: publicUser(user) });
});

// --- Profil ---
app.get("/api/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

const profileSchema = z.object({
  name: z.string().trim().min(2).max(30).optional(),
  mascot: z.enum(MASCOTS).optional(),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  subject: z.enum(SUBJECTS).optional(),
});

app.patch("/api/me", auth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Ma’lumotlar noto‘g‘ri");
  const { name, ...profile } = parsed.data;
  if (name) req.user.name = name;
  Object.assign(req.user.profile, profile);
  await save();
  res.json({ user: publicUser(req.user) });
});

// --- Test ---
const sessions = new Map();
setInterval(() => {
  const cutoff = Date.now() - 3 * 3600_000;
  for (const [id, s] of sessions) if (s.startedAt < cutoff) sessions.delete(id);
}, 600_000).unref();

const startSchema = z.object({ grade: z.number().int().min(1).max(4), subject: z.enum(SUBJECTS) });

app.post("/api/quiz/start", auth, (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Sinf yoki fan noto‘g‘ri");
  const { grade, subject } = parsed.data;
  const session = createSession({ userId: req.user.id, grade, subject, bank: getQuestionBank(grade, subject) });
  sessions.set(session.id, session);
  res.json({
    sessionId: session.id,
    grade,
    subject,
    total: QUIZ_LENGTH,
    questions: session.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options, difficulty: q.difficulty })),
  });
});

function ownSession(req, res) {
  const s = sessions.get(req.params.id);
  if (!s || s.userId !== req.user.id) {
    fail(res, 404, "Test sessiyasi topilmadi. Yangi test boshlang.");
    return null;
  }
  return s;
}

app.post("/api/quiz/:id/answer", auth, (req, res) => {
  const s = ownSession(req, res);
  if (!s) return;
  const result = answerQuestion(s, req.body?.index, req.body?.answer);
  if (result.error) return fail(res, 409, result.error);
  res.json(result);
});

app.post("/api/quiz/:id/finish", auth, async (req, res) => {
  const s = ownSession(req, res);
  if (!s) return;
  if (s.answers.includes(null)) return fail(res, 409, "Avval barcha savollarga javob bering");
  if (!s.finished) {
    s.finished = true;
    s.result = summarize(s);
    db.results.push(s.result);
    await save();
  }
  res.json({ result: s.result, state: publicState(s) });
});

// --- Natijalar ---
app.get("/api/results/:id", auth, (req, res) => {
  const r = db.results.find((x) => x.id === req.params.id && x.userId === req.user.id);
  if (!r) return fail(res, 404, "Natija topilmadi");
  res.json({ result: r });
});

app.get("/api/progress", auth, (req, res) => {
  const mine = db.results.filter((r) => r.userId === req.user.id);
  const totalPoints = mine.reduce((s, r) => s + r.score, 0);
  const bySubject = {};
  for (const subject of SUBJECTS) {
    const list = mine.filter((r) => r.subject === subject);
    bySubject[subject] = {
      attempts: list.length,
      bestScore: list.length ? Math.max(...list.map((r) => r.score)) : 0,
      avgAccuracy: list.length ? Math.round(list.reduce((s, r) => s + r.accuracy, 0) / list.length) : 0,
    };
  }
  const rewards = [...new Set(mine.flatMap((r) => r.earned))];
  const achievements = [
    { id: "first", title: "Birinchi qadam", description: "Birinchi testni yakunlading", unlocked: mine.length >= 1 },
    { id: "five", title: "Tirishqoq", description: "5 ta testni yakunlading", unlocked: mine.length >= 5 },
    { id: "perfect", title: "Mukammal!", description: "200 dan 200 ball to‘plading", unlocked: mine.some((r) => r.correct === r.total) },
    { id: "streak10", title: "To‘xtatib bo‘lmas", description: "Ketma-ket 10 ta to‘g‘ri javob", unlocked: mine.some((r) => r.bestStreak >= 10) },
    { id: "explorer", title: "Kashfiyotchi", description: "Barcha 6 fandan test topshirding", unlocked: SUBJECTS.every((s) => bySubject[s].attempts > 0) },
    { id: "thousand", title: "Ming ball", description: "Jami 1000 ball to‘plading", unlocked: totalPoints >= 1000 },
  ];
  res.json({
    totalPoints,
    quizzes: mine.length,
    totalCorrect: mine.reduce((s, r) => s + r.correct, 0),
    bySubject,
    rewards,
    achievements,
    recent: mine
      .slice(-10)
      .reverse()
      .map(({ answers, ...r }) => r),
  });
});

app.get("/api/health", (_req, res) => res.json({ ok: true, grades: GRADES, subjects: SUBJECTS }));

app.use((err, _req, res, _next) => {
  console.error(err);
  fail(res, 500, "Serverda xatolik yuz berdi");
});

if (!process.env.VERCEL) app.listen(PORT, () => console.log(`API http://localhost:${PORT} manzilida ishlamoqda`));

export default app;
