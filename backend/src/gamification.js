import { pool, tx } from "./db.js";
import { ApiError } from "./errors.js";
import { loc } from "./store.js";
import { arrangeOptions, dayInZone } from "./quizEngine.js";
import { publicQuestion, getQuestion } from "./quizService.js";
import { grantPoints, awardAchievement } from "./rewards.js";

// Do‘kon, kun savoli, haftalik topshiriqlar va qahramonlar albomi. Barcha qoidalar serverda.

export const DAILY_POINTS = 20;
export const DAILY_XP = 10;

async function lockChild(c, id) {
  const { rows } = await c.query("SELECT * FROM children WHERE id = $1 FOR UPDATE", [id]);
  return rows[0];
}

// ---------- Do‘kon ----------

export async function listShop(child) {
  const [items, owned] = await Promise.all([
    pool.query("SELECT * FROM shop_items WHERE active ORDER BY price, id"),
    pool.query("SELECT item_id, equipped FROM child_items WHERE child_id = $1", [child.id]),
  ]);
  const own = new Map(owned.rows.map((r) => [r.item_id, r.equipped]));
  return {
    balance: child.points_balance,
    level: child.level,
    items: items.rows.map((i) => ({
      id: i.id,
      category: i.category,
      name: loc(i.name, child.locale),
      price: i.price,
      minLevel: i.min_level,
      owned: own.has(i.id),
      equipped: own.get(i.id) === true,
      levelLocked: child.level < i.min_level,
      affordable: child.points_balance >= i.price,
    })),
  };
}

/** Atomik xarid: bola qatori bloklanadi, shuning uchun parallel so‘rovlar manfiy balansga olib kela olmaydi. */
export async function buyItem(child, itemId) {
  return tx(async (c) => {
    const cur = await lockChild(c, child.id);
    const { rows } = await c.query("SELECT * FROM shop_items WHERE id = $1 AND active", [String(itemId)]);
    const item = rows[0];
    if (!item) throw new ApiError(404, "Buyum topilmadi");
    const has = await c.query("SELECT 1 FROM child_items WHERE child_id = $1 AND item_id = $2", [cur.id, item.id]);
    if (has.rowCount) throw new ApiError(409, "Bu buyum allaqachon sotib olingan");
    if (cur.level < item.min_level) throw new ApiError(403, `Bu buyum ${item.min_level}-darajadan ochiladi`);
    if (cur.points_balance < item.price) throw new ApiError(409, "Ball yetarli emas");

    // Bir toifadagi boshqa buyumlar yechiladi (masalan, ikki bosh kiyimi birga kiyilmaydi).
    await c.query("UPDATE child_items SET equipped = false WHERE child_id = $1 AND item_id IN (SELECT id FROM shop_items WHERE category = $2)", [cur.id, item.category]);
    await c.query("INSERT INTO child_items (child_id, item_id, equipped) VALUES ($1,$2,true)", [cur.id, item.id]);
    const spent = await grantPoints(c, cur.id, { points: -item.price, reason: "purchase", refId: item.id });
    if (!spent.granted) throw new ApiError(409, "Bu buyum allaqachon sotib olingan");
    const achievement = await awardAchievement(c, cur.id, "shopper", cur.locale);
    const after = await lockChild(c, cur.id);
    return { balance: after.points_balance, itemId: item.id, newAchievements: achievement ? [achievement] : [] };
  });
}

export async function equipItem(child, itemId, equipped) {
  return tx(async (c) => {
    await lockChild(c, child.id);
    const { rows } = await c.query(
      "SELECT s.category FROM child_items ci JOIN shop_items s ON s.id = ci.item_id WHERE ci.child_id = $1 AND ci.item_id = $2",
      [child.id, String(itemId)],
    );
    if (!rows[0]) throw new ApiError(404, "Bu buyum sizda yo‘q");
    if (equipped) {
      await c.query("UPDATE child_items SET equipped = false WHERE child_id = $1 AND item_id IN (SELECT id FROM shop_items WHERE category = $2)", [child.id, rows[0].category]);
    }
    await c.query("UPDATE child_items SET equipped = $3 WHERE child_id = $1 AND item_id = $2", [child.id, String(itemId), equipped]);
    const eq = await c.query("SELECT item_id FROM child_items WHERE child_id = $1 AND equipped", [child.id]);
    return { equipped: eq.rows.map((r) => r.item_id) };
  });
}

// ---------- Kun savoli ----------

function dailySessionId(child, day) {
  return `daily:${child.id}:${day}`;
}

async function dailyRow(c, child, day) {
  if (!child.grade || !child.subject) throw new ApiError(409, "Avval sinf va fanni tanlang");
  const pick = await c.query(
    `SELECT id FROM questions WHERE active AND grade = $1 AND subject = $2 AND difficulty >= 2
      ORDER BY md5(id || $3) LIMIT 1`,
    [child.grade, child.subject, `${day}:${child.id}`],
  );
  const fallback = pick.rows[0] ?? (await c.query("SELECT id FROM questions WHERE active AND grade = $1 AND subject = $2 ORDER BY md5(id || $3) LIMIT 1", [child.grade, child.subject, `${day}:${child.id}`])).rows[0];
  if (!fallback) throw new ApiError(404, "Bu sinf va fan uchun savollar topilmadi");
  await c.query("INSERT INTO daily_challenges (child_id, day, question_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [child.id, day, fallback.id]);
  return (await c.query("SELECT * FROM daily_challenges WHERE child_id = $1 AND day = $2", [child.id, day])).rows[0];
}

async function dailyView(c, child, row) {
  const q = await getQuestion(c, row.question_id);
  const arranged = arrangeOptions(dailySessionId(child, row.day), q.id, loc(q.options, child.locale), q.correct_index);
  const answered = row.chosen_index !== null;
  return {
    day: row.day,
    points: DAILY_POINTS,
    question: publicQuestion(q, dailySessionId(child, row.day), child.locale),
    answered,
    result: answered
      ? { correct: row.is_correct, chosen: row.chosen_index, correctIndex: arranged.correctIndex, explanation: loc(q.explanation, child.locale) ?? "", earned: row.is_correct ? DAILY_POINTS : 0 }
      : null,
  };
}

export async function getDaily(child) {
  const day = dayInZone(new Date(), child.timezone);
  return tx(async (c) => dailyView(c, child, await dailyRow(c, child, day)));
}

export async function answerDaily(child, answer) {
  const day = dayInZone(new Date(), child.timezone);
  return tx(async (c) => {
    await lockChild(c, child.id);
    const row = await dailyRow(c, child, day);
    if (row.chosen_index !== null) return { ...(await dailyView(c, child, row)), replayed: true, newAchievements: [] };
    const q = await getQuestion(c, row.question_id);
    const arranged = arrangeOptions(dailySessionId(child, day), q.id, loc(q.options, child.locale), q.correct_index);
    if (!Number.isInteger(answer) || answer < 0 || answer >= arranged.options.length) throw new ApiError(400, "Noto‘g‘ri javob varianti");
    const correct = answer === arranged.correctIndex;
    await c.query("UPDATE daily_challenges SET chosen_index = $3, is_correct = $4, answered_at = now() WHERE child_id = $1 AND day = $2 AND chosen_index IS NULL", [child.id, day, answer, correct]);
    const newAchievements = [];
    if (correct) {
      await grantPoints(c, child.id, { points: DAILY_POINTS, xp: DAILY_XP, reason: "daily_goal", refId: `challenge:${day}` });
      const { rows } = await c.query("SELECT count(*)::int AS n FROM daily_challenges WHERE child_id = $1 AND is_correct", [child.id]);
      if (rows[0].n >= 3) {
        const a = await awardAchievement(c, child.id, "challenge3", child.locale);
        if (a) newAchievements.push(a);
      }
    }
    const fresh = (await c.query("SELECT * FROM daily_challenges WHERE child_id = $1 AND day = $2", [child.id, day])).rows[0];
    return { ...(await dailyView(c, child, fresh)), newAchievements };
  });
}

// ---------- Haftalik topshiriqlar ----------

/** Kunning (YYYY-MM-DD) haftasi dushanbasi. */
export function weekStartOf(dayStr) {
  const [y, m, d] = dayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

const WEEKLY_TASKS = [
  { id: "tests3", title: "Shu hafta 3 ta test topshiring", target: 3, reward: 50, value: (m) => m.tests },
  { id: "subjects2", title: "2 xil fandan test topshiring", target: 2, reward: 60, value: (m) => m.subjects },
  { id: "accuracy80", title: "Bitta testni kamida 80% bilan tugating (3-bosqichdan boshlab)", target: 80, reward: 40, value: (m) => m.best },
  { id: "challenge3", title: "Kun savoliga 3 marta to‘g‘ri javob bering", target: 3, reward: 40, value: (m) => m.challenges },
];

async function weeklyMetrics(c, child, week) {
  const r = await c.query(
      `SELECT count(*) FILTER (WHERE mode IN ('quiz', 'exam'))::int AS tests,
              coalesce(max(accuracy) FILTER (WHERE mode IN ('quiz', 'exam') AND test_id NOT IN ('level-1', 'level-2')), 0)::int AS best,
              count(DISTINCT subject) FILTER (WHERE mode IN ('quiz', 'exam'))::int AS subjects
         FROM results WHERE child_id = $1 AND (created_at AT TIME ZONE $2)::date BETWEEN $3::date AND ($3::date + 6)`,
      [child.id, child.timezone, week],
  );
  const ch = await c.query("SELECT count(*)::int AS n FROM daily_challenges WHERE child_id = $1 AND is_correct AND day BETWEEN $2::date AND ($2::date + 6)", [child.id, week]);
  return { ...r.rows[0], challenges: ch.rows[0].n };
}

async function weeklyView(c, child, week) {
  const m = await weeklyMetrics(c, child, week);
  const claimed = await c.query("SELECT task_id FROM weekly_claims WHERE child_id = $1 AND week_start = $2", [child.id, week]);
  const done = new Set(claimed.rows.map((r) => r.task_id));
  const tasks = WEEKLY_TASKS.map((t) => {
    const progress = Math.min(t.target, t.value(m));
    return { id: t.id, title: t.title, target: t.target, progress, reward: t.reward, complete: progress >= t.target, claimed: done.has(t.id) };
  });
  return { weekStart: week, tasks, allClaimed: tasks.every((t) => t.claimed) };
}

export async function getWeekly(child) {
  const week = weekStartOf(dayInZone(new Date(), child.timezone));
  return tx((c) => weeklyView(c, child, week));
}

export async function claimWeekly(child, taskId) {
  const task = WEEKLY_TASKS.find((t) => t.id === taskId);
  if (!task) throw new ApiError(404, "Topshiriq topilmadi");
  const week = weekStartOf(dayInZone(new Date(), child.timezone));
  return tx(async (c) => {
    await lockChild(c, child.id);
    const view = await weeklyView(c, child, week);
    const t = view.tasks.find((x) => x.id === taskId);
    if (!t.complete) throw new ApiError(409, "Topshiriq hali bajarilmagan");
    if (t.claimed) throw new ApiError(409, "Mukofot allaqachon olingan");
    const ins = await c.query("INSERT INTO weekly_claims (child_id, week_start, task_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING task_id", [child.id, week, taskId]);
    if (!ins.rowCount) throw new ApiError(409, "Mukofot allaqachon olingan");
    await grantPoints(c, child.id, { points: task.reward, xp: 10, reason: "achievement", refId: `weekly:${week}:${taskId}` });
    const fresh = await weeklyView(c, child, week);
    const newAchievements = [];
    if (fresh.allClaimed) {
      const a = await awardAchievement(c, child.id, "weekly", child.locale);
      if (a) newAchievements.push(a);
    }
    return { ...fresh, earned: task.reward, newAchievements };
  });
}

// ---------- Qahramonlar albomi ----------

const HEROES = [
  { id: "ajdarcha" },
  { id: "pandacha" },
  { id: "mushukcha" },
  { id: "kuchukcha" },
  { id: "labubu", requirement: "3-darajaga yeting", test: (x) => x.level >= 3 },
  { id: "robotcha", requirement: "«Tirishqoq» yutug‘ini oling (5 ta test)", test: (x) => x.has("five") },
  { id: "ayiqcha", requirement: "3 kun ketma-ket shug‘ullaning", test: (x) => x.bestStreak >= 3 },
  { id: "minioncha", requirement: "5-darajaga yeting", test: (x) => x.level >= 5 },
  { id: "spidermancha", requirement: "«Mukammal!» yutug‘ini oling", test: (x) => x.has("perfect") },
  { id: "mariocha", requirement: "«Kashfiyotchi» yutug‘ini oling (barcha fanlar)", test: (x) => x.has("explorer") },
];

async function heroContext(child) {
  const { rows } = await pool.query("SELECT achievement_id FROM child_achievements WHERE child_id = $1", [child.id]);
  const set = new Set(rows.map((r) => r.achievement_id));
  return { level: child.level, bestStreak: child.best_streak, has: (id) => set.has(id) };
}

export async function listHeroes(child) {
  const ctx = await heroContext(child);
  return HEROES.map((h) => ({ id: h.id, unlocked: !h.test || h.test(ctx) || child.mascot === h.id, requirement: h.requirement ?? null }));
}

/** Qahramonni almashtirishda: ochilmagan qahramonni tanlash taqiqlanadi (hozirgisini saqlab qolish mumkin). */
export async function assertHeroUnlocked(child, mascot) {
  if (!mascot || child.mascot === mascot) return;
  const hero = (await listHeroes(child)).find((h) => h.id === mascot);
  if (hero && !hero.unlocked) throw new ApiError(403, `Bu qahramon hali yopiq: ${hero.requirement}`);
}
