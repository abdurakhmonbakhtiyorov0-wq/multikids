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
import { startQuiz, activeQuiz, answerQuiz, finishQuiz, getResult, getProgress, listTests } from "./quizService.js";
import { TESTS } from "./tests.js";
import { limit, reset as resetLimit } from "./rateLimit.js";
import { hasConsent, recordConsent, pinStatus, setPin, checkPin, overview, deleteChild, deleteAccount, requestPasswordReset, resetPassword } from "./parent.js";
import { listShop, buyItem, equipItem, getDaily, answerDaily, getWeekly, claimWeekly, listHeroes, assertHeroUnlocked } from "./gamification.js";
import { SUBJECTS, GRADES } from "./questions/index.js";

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || "http://localhost:3000,https://multikids-q7zt.vercel.app").split(",").map((s) => s.trim());
const MASCOTS = ["ajdarcha", "pandacha", "labubu", "mushukcha", "robotcha", "ayiqcha", "minioncha", "spidermancha", "mariocha", "kuchukcha"];
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX) || 20;
const VERCEL_ORIGIN = /^https:\/\/multikids[\w-]*\.vercel\.app$/;

const app = express();
// Vercel orqasida haqiqiy mijoz IP si X-Forwarded-For dan olinadi (cheklovlar IP bo‘yicha ishlaydi).
app.set("trust proxy", 1);
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

// Urinishlar cheklovi bazada saqlanadi (rateLimit.js) — serverless nusxalari orasida umumiy.
const rateLimit = (name, max = RATE_MAX, windowSec = 900) => async (req, _res, next) => {
  await limit(`${name}:ip:${req.ip}`, max, windowSec);
  next();
};

/** Foydalanuvchi + faol bola ma’lumoti; rozilik holati bilan. */
async function userPayload(user, child) {
  return { ...publicUser(user, child), needsConsent: !(await hasConsent(user.id)) };
}

/** Bolalar ma’lumotini qayta ishlashdan oldin ota-ona roziligi shart. */
async function requireConsent(req, _res, next) {
  if (!(await hasConsent(req.user.id))) throw new ApiError(409, "Avval ota-ona roziligini bering (Maxfiylik siyosati).");
  next();
}

/** Ota-ona bo‘limi: PIN orqali olingan qisqa muddatli token (X-Parent-Token). */
function parentOnly(req, _res, next) {
  const token = req.headers["x-parent-token"];
  if (!token) throw new ApiError(403, "Ota-ona PIN-kodi kerak");
  try {
    const p = jwt.verify(String(token), jwtSecret(), { algorithms: ["HS256"] });
    if (p.scope !== "parent" || p.sub !== req.user.id || p.tv !== req.user.token_version) throw new Error("scope");
  } catch (err) {
    if (err instanceof ConfigError) throw err;
    throw new ApiError(403, "Ota-ona sessiyasi tugagan. PIN-kodni qayta kiriting");
  }
  next();
}

// --- Auth ---
const registerSchema = z.object({
  name: z.string().trim().min(2, "Ism kamida 2 harfdan iborat bo‘lsin").max(30, "Ism juda uzun"),
  email: z.string().trim().toLowerCase().email("Email manzil noto‘g‘ri"),
  password: z.string().min(6, "Parol kamida 6 belgidan iborat bo‘lsin").max(100),
  consent: z.literal(true, { error: "Maxfiylik siyosatiga rozilik berish shart" }),
});

app.post("/api/auth/register", rateLimit("register"), async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw bad(parsed.error.issues[0].message);
  const { name, email, password } = parsed.data;
  const user = await createAccount({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  if (!user) throw new ApiError(409, "Bu email bilan hisob allaqachon mavjud");
  await recordConsent(user.id);
  const child = await resolveChild(user.id);
  res.status(201).json({ token: sign(user), user: await userPayload(user, child) });
});

app.post("/api/consent", auth, async (req, res) => {
  if (req.body?.accept !== true) throw bad("Rozilik berilmadi");
  await recordConsent(req.user.id);
  res.json({ user: await userPayload(req.user, req.child) });
});

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email("Email manzil noto‘g‘ri"), password: z.string().min(1, "Parolni kiriting") });

app.post("/api/auth/login", rateLimit("login"), async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw bad(parsed.error.issues[0].message);
  // Bitta akkauntni turli IP lardan tanlab ochishga urinishlardan himoya: email bo‘yicha ham cheklanadi.
  const emailKey = `login:email:${parsed.data.email}`;
  await limit(emailKey, 10, 900);
  const user = await findUserByEmail(parsed.data.email);
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) throw new ApiError(401, "Email yoki parol noto‘g‘ri");
  await resetLimit(emailKey);
  const child = await resolveChild(user.id);
  res.json({ token: sign(user), user: await userPayload(user, child) });
});

// --- Parolni tiklash (email orqali) ---
const appUrl = () => (process.env.APP_URL || CLIENT_ORIGIN.find((o) => o.startsWith("https://")) || CLIENT_ORIGIN[0]).replace(/\/$/, "");

app.post("/api/auth/forgot", rateLimit("forgot", 10, 3600), async (req, res) => {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email("Email manzil noto‘g‘ri") }).safeParse(req.body);
  if (!parsed.success) throw bad(parsed.error.issues[0].message);
  await limit(`forgot:email:${parsed.data.email}`, 3, 3600);
  res.json(await requestPasswordReset(parsed.data.email, appUrl()));
});

app.post("/api/auth/reset", rateLimit("reset", 10, 3600), async (req, res) => {
  const parsed = z.object({ token: z.string().min(20).max(200), password: z.string().min(6, "Parol kamida 6 belgidan iborat bo‘lsin").max(100) }).safeParse(req.body);
  if (!parsed.success) throw bad(parsed.error.issues[0].message);
  await resetPassword(parsed.data.token, parsed.data.password);
  res.json({ ok: true });
});

// --- Profil ---
app.get("/api/me", auth, async (req, res) => res.json({ user: await userPayload(req.user, req.child) }));

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
  await assertHeroUnlocked(req.child, parsed.data.mascot);
  await updateChild(req.child.id, parsed.data);
  res.json({ user: await userPayload(req.user, await resolveChild(req.user.id, req.child.id)) });
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

app.post("/api/children", auth, parentOnly, async (req, res) => {
  const parsed = childSchema.safeParse(req.body);
  if (!parsed.success) throw bad(parsed.error.issues[0].message);
  const c = await createChild(req.user.id, parsed.data);
  res.status(201).json({ child: { id: c.id, name: c.name, grade: c.grade, mascot: c.mascot, level: c.level } });
});

// --- Test ---
const TEST_IDS = TESTS.map((t) => t.id);
const startSchema = z.object({
  grade: z.number().int().min(1).max(4),
  subject: z.enum(SUBJECTS),
  mode: z.enum(["quiz", "mistakes", "exam"]).optional(),
  testId: z.enum(TEST_IDS).optional(),
});

app.post("/api/quiz/start", auth, requireConsent, async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) throw bad("Sinf yoki fan noto‘g‘ri");
  res.json(await startQuiz(req.child, parsed.data));
});

app.get("/api/quiz/active", auth, async (req, res) => {
  const parsed = startSchema.safeParse({ grade: Number(req.query.grade), subject: req.query.subject, mode: req.query.mode, testId: req.query.testId });
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
app.get("/api/tests", auth, async (req, res) => {
  const parsed = startSchema.pick({ grade: true, subject: true }).safeParse({ grade: Number(req.query.grade ?? req.child.grade), subject: req.query.subject ?? req.child.subject });
  if (!parsed.success) throw bad("Sinf yoki fan noto‘g‘ri");
  res.json({ tests: await listTests(req.child, parsed.data) });
});
// --- Do‘kon, kun savoli, haftalik topshiriqlar, albom ---
app.get("/api/shop", auth, async (req, res) => res.json(await listShop(req.child)));
app.post("/api/shop/:id/buy", auth, requireConsent, async (req, res) => res.json(await buyItem(req.child, req.params.id)));
app.post("/api/shop/:id/equip", auth, async (req, res) => {
  const parsed = z.object({ equipped: z.boolean() }).safeParse(req.body);
  if (!parsed.success) throw bad("Noto‘g‘ri so‘rov");
  res.json(await equipItem(req.child, req.params.id, parsed.data.equipped));
});
app.get("/api/daily", auth, async (req, res) => res.json(await getDaily(req.child)));
app.post("/api/daily/answer", auth, async (req, res) => {
  const parsed = z.object({ answer: z.number().int() }).safeParse(req.body);
  if (!parsed.success) throw bad("Noto‘g‘ri javob");
  res.json(await answerDaily(req.child, parsed.data.answer));
});
app.get("/api/weekly", auth, async (req, res) => res.json(await getWeekly(req.child)));
app.post("/api/weekly/:id/claim", auth, async (req, res) => res.json(await claimWeekly(req.child, req.params.id)));
app.get("/api/heroes", auth, async (req, res) => res.json({ heroes: await listHeroes(req.child), current: req.child.mascot }));
// --- Ota-ona bo‘limi ---
app.get("/api/parent/status", auth, async (req, res) => res.json(await pinStatus(req.user.id)));

const pinSchema = z.string().regex(/^\d{4,6}$/, "PIN-kod 4–6 raqamdan iborat bo‘lsin");

app.post("/api/parent/pin", auth, rateLimit("pin-set", 10, 3600), async (req, res) => {
  const parsed = z.object({ pin: pinSchema, password: z.string().min(1, "Parolni kiriting") }).safeParse(req.body);
  if (!parsed.success) throw bad(parsed.error.issues[0].message);
  await setPin(req.user, parsed.data);
  res.json({ ok: true });
});

app.post("/api/parent/verify", auth, async (req, res) => {
  const parsed = z.object({ pin: pinSchema }).safeParse(req.body);
  if (!parsed.success) throw bad(parsed.error.issues[0].message);
  const key = `pin:${req.user.id}`;
  await limit(key, 5, 900, "PIN-kod juda ko‘p marta noto‘g‘ri kiritildi. 15 daqiqadan keyin urinib ko‘ring.");
  if (!(await checkPin(req.user, parsed.data.pin))) throw new ApiError(401, "PIN-kod noto‘g‘ri");
  await resetLimit(key);
  const expiresIn = 15 * 60;
  res.json({ parentToken: jwt.sign({ sub: req.user.id, scope: "parent", tv: req.user.token_version }, jwtSecret(), { expiresIn }), expiresIn });
});

app.get("/api/parent/overview", auth, parentOnly, async (req, res) => {
  res.json(await overview(req.user.id, req.query.child ?? req.child.id, req.child.locale));
});

app.delete("/api/parent/children/:id", auth, parentOnly, async (req, res) => {
  await deleteChild(req.user.id, req.params.id, req.body?.confirmName);
  res.json({ ok: true });
});

app.delete("/api/parent/account", auth, parentOnly, rateLimit("delete-account", 5, 3600), async (req, res) => {
  await deleteAccount(req.user, { password: String(req.body?.password ?? ""), confirm: req.body?.confirm });
  res.json({ ok: true });
});

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
