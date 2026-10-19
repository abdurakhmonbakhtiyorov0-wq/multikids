import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { init, pool } from "./db.js";
import { jwtSecret, ConfigError } from "./config.js";
import { ApiError, isDbUnavailable } from "./errors.js";
import { findUserById, findUserByEmail, createAccount, listChildren, resolveChild, createChild, updateChild, publicUser } from "./store.js";
import { startQuiz, activeQuiz, answerQuiz, finishQuiz, getResult, getProgress } from "./quizService.js";
import { SUBJECTS, GRADES } from "./questions/index.js";

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || "http://localhost:3000,https://multikids-two.vercel.app").split(",").map((s) => s.trim());
const MASCOTS = ["ajdarcha", "pandacha", "labubu", "mushukcha", "robotcha", "ayiqcha", "minioncha", "spidermancha", "mariocha", "kuchukcha"];
const VERCEL_ORIGIN = /^https:\/\/multikids[\w-]*\.vercel\.app$/;

const app = express();
// Token Authorization sarlavhasida yuboriladi (cookie emas), shuning uchun loyiha domenlarini ruxsat etish xavfsiz.
app.use(cors({ origin: (origin, cb) => cb(null, !origin || CLIENT_ORIGIN.includes(origin) || VERCEL_ORIGIN.test(origin)) }));
app.use(express.json({ limit: "50kb" }));

// Baza tayyorligi (birinchi so‘rovda tekshiriladi; xato bo‘lsa keyingi so‘rovda qayta uriniladi).
app.use(async (_req, _res, next) => {
  try {
    await init();
    next();
  } catch (err) {
    next(err);
  }
});

// --- Yordamchilar ---
const sign = (u) => jwt.sign({ sub: u.id, tv: u.token_version }, jwtSecret(), { expiresIn: "7d" });
const bad = (message) => new ApiError(400, message);

async function auth(req, _res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) throw new ApiError(401, "Tizimga kiring");
  let payload;
  try {
    payload = jwt.verify(token, jwtSecret(), { algorithms: ["HS256"] });
  } catch (err) {
    if (err instanceof ConfigError) throw err;
    throw new ApiError(401, "Sessiya muddati tugagan, qaytadan kiring");
  }
  const user = await findUserById(payload.sub);
  if (!user || user.token_version !== payload.tv) throw new ApiError(401, "Sessiya yaroqsiz, qaytadan kiring");
  req.user = user;
  req.child = await resolveChild(user.id, req.headers["x-child-id"]);
  next();
}

// Oddiy kirish urinishlari cheklovchisi (IP bo'yicha, 15 daqiqada 20 ta). Serverless'da har bir nusxa uchun alohida.
const attempts = new Map();
function rateLimit(req, _res, next) {
  const now = Date.now();
  const rec = attempts.get(req.ip) ?? { count: 0, reset: now + 15 * 60_000 };
  if (now > rec.reset) Object.assign(rec, { count: 0, reset: now + 15 * 60_000 });
  rec.count++;
  attempts.set(req.ip, rec);
  if (rec.count > 20) throw new ApiError(429, "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.");
  next();
}

// --- Auth ---
const registerSchema = z.object({
  name: z.string().trim().min(2, "Ism kamida 2 harfdan iborat bo‘lsin").max(30, "Ism juda uzun"),
  email: z.string().trim().toLowerCase().email("Email manzil noto‘g‘ri"),
  password: z.string().min(6, "Parol kamida 6 belgidan iborat bo‘lsin").max(100),
});

app.post("/api/auth/register", rateLimit, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw bad(parsed.error.issues[0].message);
  const { name, email, password } = parsed.data;
  const user = await createAccount({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  if (!user) throw new ApiError(409, "Bu email bilan hisob allaqachon mavjud");
  const child = await resolveChild(user.id);
  res.status(201).json({ token: sign(user), user: publicUser(user, child) });
});

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email("Email manzil noto‘g‘ri"), password: z.string().min(1, "Parolni kiriting") });

app.post("/api/auth/login", rateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw bad(parsed.error.issues[0].message);
  const user = await findUserByEmail(parsed.data.email);
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) throw new ApiError(401, "Email yoki parol noto‘g‘ri");
  const child = await resolveChild(user.id);
  res.json({ token: sign(user), user: publicUser(user, child) });
});

// --- Profil ---
app.get("/api/me", auth, (req, res) => res.json({ user: publicUser(req.user, req.child) }));

const profileSchema = z.object({
  name: z.string().trim().min(2).max(30).optional(),
  mascot: z.enum(MASCOTS).optional(),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  subject: z.enum(SUBJECTS).optional(),
  locale: z.enum(["uz", "ru"]).optional(),
  soundEnabled: z.boolean().optional(),
  voiceAutoplay: z.boolean().optional(),
  timezone: z
    .string()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    })
    .optional(),
});

app.patch("/api/me", auth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) throw bad("Ma’lumotlar noto‘g‘ri");
  const child = await updateChild(req.child.id, parsed.data);
  res.json({ user: publicUser(req.user, child) });
});

// --- Bola profillari ---
app.get("/api/children", auth, async (req, res) => {
  const list = await listChildren(req.user.id);
  res.json({ children: list.map((c) => ({ id: c.id, name: c.name, grade: c.grade, mascot: c.mascot, level: c.level })), activeId: req.child.id });
});

const childSchema = z.object({
  name: z.string().trim().min(2, "Ism kamida 2 harfdan iborat bo‘lsin").max(30),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  mascot: z.enum(MASCOTS).optional(),
});

app.post("/api/children", auth, async (req, res) => {
  const parsed = childSchema.safeParse(req.body);
  if (!parsed.success) throw bad(parsed.error.issues[0].message);
  const c = await createChild(req.user.id, parsed.data);
  res.status(201).json({ child: { id: c.id, name: c.name, grade: c.grade, mascot: c.mascot, level: c.level } });
});

// --- Test ---
const startSchema = z.object({ grade: z.number().int().min(1).max(4), subject: z.enum(SUBJECTS), mode: z.enum(["quiz", "mistakes"]).optional() });

app.post("/api/quiz/start", auth, async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) throw bad("Sinf yoki fan noto‘g‘ri");
  res.json(await startQuiz(req.child, parsed.data));
});

app.get("/api/quiz/active", auth, async (req, res) => {
  const parsed = startSchema.safeParse({ grade: Number(req.query.grade), subject: req.query.subject, mode: req.query.mode });
  if (!parsed.success) throw bad("Sinf yoki fan noto‘g‘ri");
  res.json({ session: await activeQuiz(req.child, parsed.data) });
});

const answerSchema = z.object({ index: z.number().int(), answer: z.number().int() });

app.post("/api/quiz/:id/answer", auth, async (req, res) => {
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) throw bad("Noto‘g‘ri javob");
  res.json(await answerQuiz(req.child, req.params.id, parsed.data));
});

app.post("/api/quiz/:id/finish", auth, async (req, res) => {
  res.json(await finishQuiz(req.child, req.params.id));
});

// --- Natijalar ---
app.get("/api/results/:id", auth, async (req, res) => res.json({ result: await getResult(req.child, req.params.id) }));
app.get("/api/progress", auth, async (req, res) => res.json(await getProgress(req.child, SUBJECTS)));

app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true, grades: GRADES, subjects: SUBJECTS });
});

app.use((err, req, res, _next) => {
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ConfigError) {
    console.error(err.message);
    return res.status(500).json({ error: "Server noto‘g‘ri sozlangan. Administrator JWT_SECRET ni tekshirsin." });
  }
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "So‘rov formati noto‘g‘ri" });
  console.error(`${req.method} ${req.path}:`, err.code ?? "", err.message);
  if (isDbUnavailable(err) || /schema|sxema/i.test(err.message)) return res.status(503).json({ error: "Ma’lumotlar bazasi vaqtincha mavjud emas. Birozdan keyin urinib ko‘ring." });
  res.status(500).json({ error: "Serverda xatolik yuz berdi" });
});

if (!process.env.VERCEL && !process.env.MULTIKIDS_NO_LISTEN) {
  try {
    jwtSecret();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  init()
    .then(() => app.listen(PORT, () => console.log(`API http://localhost:${PORT} manzilida ishlamoqda`)))
    .catch((err) => {
      console.error("PostgreSQL'ga ulanib bo‘lmadi:", err.message);
      process.exit(1);
    });
}

export default app;
