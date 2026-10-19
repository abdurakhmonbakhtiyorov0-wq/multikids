import { pool, tx } from "./db.js";
import { ApiError } from "./errors.js";
import { loc } from "./store.js";
import {
  QUIZ_LENGTH,
  COMPLETION_XP,
  MASTERY_STREAK,
  DIFFICULTY_NAMES,
  arrangeOptions,
  targetDifficulty,
  adapt,
  replay,
  publicState,
  pointsPerCorrect,
  levelForXp,
  nextStreak,
  dayInZone,
} from "./quizEngine.js";

const SESSION_TTL = "24 hours";
const SUBJECT_COUNT = 6;

// ---------- Yordamchilar ----------

/** Savol o‘quvchiga ko‘rsatiladigan shaklda (to‘g‘ri javobsiz). Variantlar tartibi sessiyaga bog‘liq. */
function publicQuestion(q, sessionId, locale) {
  const { options } = arrangeOptions(sessionId, q.id, loc(q.options, locale), q.correct_index);
  return {
    id: q.id,
    prompt: loc(q.prompt, locale),
    options,
    difficulty: DIFFICULTY_NAMES[q.difficulty],
    topic: q.topic,
    image: q.image_path ? { src: q.image_path, alt: loc(q.image_alt, locale) ?? "" } : null,
  };
}

async function getQuestion(c, id) {
  const { rows } = await c.query("SELECT * FROM questions WHERE id = $1", [id]);
  return rows[0];
}

/** Maqsad qiyinlikka eng yaqin, bola uzoq vaqt ko‘rmagan savol. Tanlov serverda — mijoz ta’sir qila olmaydi. */
async function pickQuestion(c, { childId, grade, subject, used, target }) {
  const { rows } = await c.query(
    `SELECT q.id FROM questions q
       LEFT JOIN question_stats s ON s.child_id = $1 AND s.question_id = q.id
      WHERE q.active AND q.grade = $2 AND q.subject = $3 AND NOT (q.id = ANY($4::text[]))
      ORDER BY abs(q.difficulty - $5), s.last_answered_at NULLS FIRST, random()
      LIMIT 1`,
    [childId, grade, subject, used, target],
  );
  return rows[0]?.id ?? null;
}

async function answersOf(c, sessionId) {
  const { rows } = await c.query("SELECT position, question_id, chosen_index, is_correct FROM quiz_answers WHERE session_id = $1 ORDER BY position", [sessionId]);
  return rows;
}

async function lockSession(c, sessionId, childId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(sessionId))) throw new ApiError(404, "Test sessiyasi topilmadi. Yangi test boshlang.");
  const { rows } = await c.query("SELECT * FROM quiz_sessions WHERE id = $1 AND child_id = $2 FOR UPDATE", [sessionId, childId]);
  if (!rows[0]) throw new ApiError(404, "Test sessiyasi topilmadi. Yangi test boshlang.");
  return rows[0];
}

async function expireIfStale(c, s) {
  if (s.status === "active" && new Date(s.expires_at) < new Date()) {
    await c.query("UPDATE quiz_sessions SET status = 'expired' WHERE id = $1", [s.id]);
    s.status = "expired";
  }
}

async function describe(c, s, child, resumed) {
  const answers = await answersOf(c, s.id);
  const state = publicState(replay(answers.map((a) => ({ isCorrect: a.is_correct }))), s.mode);
  const qid = s.question_ids[s.current_index];
  const question = qid && s.current_index < s.total ? publicQuestion(await getQuestion(c, qid), s.id, child.locale) : null;
  return { sessionId: s.id, mode: s.mode, grade: s.grade, subject: s.subject, total: s.total, index: s.current_index, question, state, resumed };
}

// ---------- Boshlash / davom ettirish ----------

export async function startQuiz(child, { grade, subject, mode = "quiz" }) {
  try {
    return await tx(async (c) => {
      await c.query("UPDATE quiz_sessions SET status = 'expired' WHERE child_id = $1 AND status = 'active' AND expires_at < now()", [child.id]);
      const existing = await c.query(
        "SELECT * FROM quiz_sessions WHERE child_id = $1 AND subject = $2 AND grade = $3 AND mode = $4 AND status = 'active' FOR UPDATE",
        [child.id, subject, grade, mode],
      );
      if (existing.rows[0]) return describe(c, existing.rows[0], child, true);

      let total;
      let ids;
      if (mode === "mistakes") {
        const { rows } = await c.query(
          `SELECT q.id FROM question_stats s JOIN questions q ON q.id = s.question_id
            WHERE s.child_id = $1 AND s.wrong_count > 0 AND NOT s.mastered AND q.active AND q.grade = $2 AND q.subject = $3
            ORDER BY q.difficulty, s.wrong_count DESC, random() LIMIT $4`,
          [child.id, grade, subject, QUIZ_LENGTH],
        );
        if (!rows.length) throw new ApiError(409, "Hozircha xatolar yo‘q — ajoyib!");
        ids = rows.map((r) => r.id);
        total = ids.length;
      } else {
        const { rows } = await c.query("SELECT count(*)::int AS n FROM questions WHERE active AND grade = $1 AND subject = $2", [grade, subject]);
        if (!rows[0].n) throw new ApiError(404, "Bu sinf va fan uchun savollar topilmadi");
        total = Math.min(QUIZ_LENGTH, rows[0].n);
        const first = await pickQuestion(c, { childId: child.id, grade, subject, used: [], target: targetDifficulty(0, total, 0) });
        ids = [first];
      }
      const { rows } = await c.query(
        `INSERT INTO quiz_sessions (child_id, mode, grade, subject, total, question_ids, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6, now() + interval '${SESSION_TTL}') RETURNING *`,
        [child.id, mode, grade, subject, total, ids],
      );
      return describe(c, rows[0], child, false);
    });
  } catch (err) {
    // Ikki parallel "start": unique indeks ikkinchisini rad etadi — mavjud sessiyani qaytaramiz.
    if (err.code === "23505") return startQuiz(child, { grade, subject, mode });
    throw err;
  }
}

/** Sahifa yangilangandan keyin: faol sessiya bormi? (yaratmaydi) */
export async function activeQuiz(child, { grade, subject, mode = "quiz" }) {
  return tx(async (c) => {
    const { rows } = await c.query(
      "SELECT * FROM quiz_sessions WHERE child_id = $1 AND subject = $2 AND grade = $3 AND mode = $4 AND status = 'active' AND expires_at > now()",
      [child.id, subject, grade, mode],
    );
    return rows[0] ? describe(c, rows[0], child, true) : null;
  });
}

// ---------- Javob ----------

function answerPayload(q, arranged, answers, upTo, s, locale) {
  const r = replay(answers.slice(0, upTo + 1).map((a) => ({ isCorrect: a.is_correct })));
  return {
    correct: answers[upTo].is_correct,
    correctIndex: arranged.correctIndex,
    explanation: loc(q.explanation, locale) ?? "",
    event: r.events[upTo],
    state: publicState(r, s.mode),
  };
}

export async function answerQuiz(child, sessionId, { index, answer }) {
  return tx(async (c) => {
    const s = await lockSession(c, sessionId, child.id);
    if (!Number.isInteger(index) || index < 0 || index >= s.total) throw new ApiError(400, "Noto‘g‘ri savol raqami");
    const answers = await answersOf(c, s.id);
    const q = await getQuestion(c, s.question_ids[index] ?? "");
    const arranged = q && arrangeOptions(s.id, q.id, loc(q.options, child.locale), q.correct_index);

    // Takroriy so‘rov (tarmoq uzilgandan keyin qayta yuborish): saqlangan natijani qaytaramiz, hech narsa o‘zgarmaydi.
    if (answers[index]) return { ...answerPayload(q, arranged, answers, index, s, child.locale), next: null, replayed: true };

    await expireIfStale(c, s);
    if (s.status === "expired") throw new ApiError(410, "Sessiya muddati tugagan. Yangi test boshlang.");
    if (s.status !== "active") throw new ApiError(409, "Test allaqachon tugagan");
    if (index !== s.current_index || !q) throw new ApiError(409, "Savollarga tartib bilan javob bering");
    if (!Number.isInteger(answer) || answer < 0 || answer >= arranged.options.length) throw new ApiError(400, "Noto‘g‘ri javob varianti");

    const isCorrect = answer === arranged.correctIndex;
    await c.query("INSERT INTO quiz_answers (session_id, position, question_id, child_id, chosen_index, is_correct) VALUES ($1,$2,$3,$4,$5,$6)", [
      s.id, index, q.id, child.id, answer, isCorrect,
    ]);
    await c.query(
      `INSERT INTO question_stats (child_id, question_id, attempts, wrong_count, correct_streak, mastered, last_answered_at)
       VALUES ($1, $2, 1, $3, $4, false, now())
       ON CONFLICT (child_id, question_id) DO UPDATE SET
         attempts = question_stats.attempts + 1,
         wrong_count = question_stats.wrong_count + $3,
         correct_streak = CASE WHEN $5 THEN question_stats.correct_streak + 1 ELSE 0 END,
         mastered = CASE WHEN $5 THEN question_stats.correct_streak + 1 >= $6 AND question_stats.wrong_count > 0 ELSE false END,
         last_answered_at = now()`,
      [child.id, q.id, isCorrect ? 0 : 1, isCorrect ? 1 : 0, isCorrect, MASTERY_STREAK],
    );

    // Moslashuv va keyingi savol (faqat oddiy rejim; xatolar rejimida savollar oldindan tanlangan).
    let { correct_streak: cs, wrong_streak: ws, difficulty_offset: offset } = s;
    let ids = s.question_ids;
    let total = s.total;
    let nextId = ids[index + 1] ?? null;
    if (s.mode === "quiz") {
      ({ correctStreak: cs, wrongStreak: ws, offset } = adapt({ correctStreak: cs, wrongStreak: ws, offset }, isCorrect));
      if (index + 1 < total) {
        nextId = await pickQuestion(c, { childId: child.id, grade: s.grade, subject: s.subject, used: ids, target: targetDifficulty(index + 1, total, offset) });
        if (nextId) ids = [...ids, nextId];
        else total = index + 1; // bank tugab qoldi — testni qisqartiramiz, xato bermaymiz
      }
    }
    await c.query(
      `UPDATE quiz_sessions SET current_index = $2, correct_streak = $3, wrong_streak = $4, difficulty_offset = $5, question_ids = $6, total = $7,
              last_activity_at = now(), expires_at = now() + interval '${SESSION_TTL}' WHERE id = $1`,
      [s.id, index + 1, cs, ws, offset, ids, total],
    );

    const all = [...answers, { is_correct: isCorrect }];
    const next = nextId && index + 1 < total ? publicQuestion(await getQuestion(c, nextId), s.id, child.locale) : null;
    return { ...answerPayload(q, arranged, all, index, s, child.locale), next, total };
  });
}

// ---------- Yakunlash (mukofotlar bir marta, tranzaksiyada) ----------

const ACHIEVEMENT_RULES = {
  first: (m) => m.quizzes >= 1,
  five: (m) => m.quizzes >= 5,
  perfect: (m) => m.perfect,
  streak10: (m) => m.bestAnswerStreak >= 10,
  explorer: (m) => m.subjects >= SUBJECT_COUNT,
  thousand: (m) => m.lifetimePoints >= 1000,
  week: (m) => m.dayStreak >= 7,
};

async function evaluateAchievements(c, child, dayStreak) {
  const { rows } = await c.query(
    `SELECT count(*) FILTER (WHERE mode = 'quiz')::int AS quizzes,
            bool_or(mode = 'quiz' AND correct = total) AS perfect,
            coalesce(max(best_streak), 0)::int AS best_answer_streak,
            count(DISTINCT subject) FILTER (WHERE mode = 'quiz')::int AS subjects,
            coalesce(sum(points_awarded), 0)::int AS lifetime_points
       FROM results WHERE child_id = $1`,
    [child.id],
  );
  const m = {
    quizzes: rows[0].quizzes,
    perfect: Boolean(rows[0].perfect),
    bestAnswerStreak: rows[0].best_answer_streak,
    subjects: rows[0].subjects,
    lifetimePoints: rows[0].lifetime_points,
    dayStreak,
  };
  const unlocked = [];
  const catalog = (await c.query("SELECT id, reward_points FROM achievements")).rows;
  for (const a of catalog) {
    if (!ACHIEVEMENT_RULES[a.id]?.(m)) continue;
    const ins = await c.query("INSERT INTO child_achievements (child_id, achievement_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING achievement_id", [child.id, a.id]);
    if (ins.rowCount) unlocked.push(a);
  }
  return unlocked;
}

async function resultView(c, row, child) {
  const answers = (
    await c.query(
      `SELECT a.position, a.chosen_index, a.is_correct, q.* FROM quiz_answers a JOIN questions q ON q.id = a.question_id
        WHERE a.session_id = $1 ORDER BY a.position`,
      [row.session_id],
    )
  ).rows;
  const r = replay(answers.map((a) => ({ isCorrect: a.is_correct })));
  return {
    id: row.id,
    grade: row.grade,
    subject: row.subject,
    mode: row.mode,
    total: row.total,
    correct: row.correct,
    incorrect: row.incorrect,
    score: row.points_awarded,
    maxScore: row.total * pointsPerCorrect(row.mode),
    xp: row.xp_awarded,
    accuracy: row.accuracy,
    bestStreak: row.best_streak,
    equipped: r.equipped,
    earned: r.earned,
    durationSec: row.duration_sec,
    createdAt: row.created_at.toISOString(),
    answers: answers.map((a) => {
      const arranged = arrangeOptions(row.session_id, a.id, loc(a.options, child.locale), a.correct_index);
      return {
        questionId: a.id,
        prompt: loc(a.prompt, child.locale),
        options: arranged.options,
        chosen: a.chosen_index,
        correctIndex: arranged.correctIndex,
        explanation: loc(a.explanation, child.locale) ?? "",
      };
    }),
  };
}

export async function finishQuiz(child, sessionId) {
  return tx(async (c) => {
    const s = await lockSession(c, sessionId, child.id);
    const done = (await c.query("SELECT * FROM results WHERE session_id = $1", [s.id])).rows[0];
    if (done) return { result: await resultView(c, done, child), newAchievements: [], alreadyFinished: true };

    await expireIfStale(c, s);
    if (s.status === "expired") throw new ApiError(410, "Sessiya muddati tugagan. Yangi test boshlang.");
    if (s.status !== "active") throw new ApiError(409, "Test yakunlanmagan yoki bekor qilingan");
    const answers = await answersOf(c, s.id);
    if (answers.length < s.total) throw new ApiError(409, "Avval barcha savollarga javob bering");

    const r = replay(answers.map((a) => ({ isCorrect: a.is_correct })));
    const points = r.correct * pointsPerCorrect(s.mode);
    const xp = points + COMPLETION_XP;
    const durationSec = Math.max(0, Math.round((Date.now() - new Date(s.started_at).getTime()) / 1000));

    const inserted = await c.query(
      `INSERT INTO results (session_id, child_id, mode, grade, subject, total, correct, incorrect, accuracy, best_streak, points_awarded, xp_awarded, duration_sec)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (session_id) DO NOTHING RETURNING *`,
      [s.id, child.id, s.mode, s.grade, s.subject, s.total, r.correct, r.incorrect, Math.round((r.correct / s.total) * 100), r.bestStreak, points, xp, durationSec],
    );
    if (!inserted.rows[0]) throw new ApiError(409, "Natija allaqachon saqlangan");
    await c.query("UPDATE quiz_sessions SET status = 'finished', finished_at = now() WHERE id = $1", [s.id]);

    // Bola qatorini bloklab, ball/XP/seriyani yangilaymiz (parallel so‘rovlar ketma-ket bajariladi).
    const cur = (await c.query("SELECT * FROM children WHERE id = $1 FOR UPDATE", [child.id])).rows[0];
    const today = dayInZone(new Date(), cur.timezone);
    const lastDay = cur.last_active_day ?? null;
    const streak = nextStreak({ lastDay, current: cur.current_streak, best: cur.best_streak }, today);

    await c.query("INSERT INTO point_ledger (child_id, points, xp, reason, ref_id) VALUES ($1,$2,$3,'quiz',$4) ON CONFLICT DO NOTHING", [child.id, points, xp, inserted.rows[0].id]);
    await c.query(
      `INSERT INTO daily_activity (child_id, day, quizzes, correct, duration_sec, goal_met) VALUES ($1,$2,1,$3,$4,$5)
       ON CONFLICT (child_id, day) DO UPDATE SET quizzes = daily_activity.quizzes + 1, correct = daily_activity.correct + $3,
         duration_sec = daily_activity.duration_sec + $4, goal_met = daily_activity.quizzes + 1 >= $6`,
      [child.id, today, r.correct, durationSec, 1 >= cur.daily_goal, cur.daily_goal],
    );

    const unlocked = await evaluateAchievements(c, cur, streak.current);
    let bonus = 0;
    for (const a of unlocked) {
      if (!a.reward_points) continue;
      const led = await c.query("INSERT INTO point_ledger (child_id, points, xp, reason, ref_id) VALUES ($1,$2,0,'achievement',$3) ON CONFLICT DO NOTHING", [child.id, a.reward_points, a.id]);
      if (led.rowCount) bonus += a.reward_points;
    }

    const newXp = cur.xp + xp;
    await c.query(
      `UPDATE children SET points_balance = points_balance + $2, xp = $3, level = $4, current_streak = $5, best_streak = $6,
              last_active_day = $7, updated_at = now() WHERE id = $1`,
      [child.id, points + bonus, newXp, levelForXp(newXp), streak.current, streak.best, today],
    );

    const titles = (await c.query("SELECT id, title, description FROM achievements WHERE id = ANY($1::text[])", [unlocked.map((a) => a.id)])).rows;
    return {
      result: await resultView(c, inserted.rows[0], child),
      newAchievements: titles.map((t) => ({ id: t.id, title: loc(t.title, child.locale), description: loc(t.description, child.locale) })),
      streak: streak.current,
      level: levelForXp(newXp),
      state: publicState(r, s.mode),
    };
  });
}

// ---------- O‘qish ----------

export async function getResult(child, resultId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(resultId))) throw new ApiError(404, "Natija topilmadi");
  const { rows } = await pool.query("SELECT * FROM results WHERE id = $1 AND child_id = $2", [resultId, child.id]);
  if (!rows[0]) throw new ApiError(404, "Natija topilmadi");
  return tx((c) => resultView(c, rows[0], child));
}

export async function getProgress(child, subjects) {
  const [{ rows: results }, { rows: unlocked }, { rows: catalog }, { rows: today }, { rows: mistakes }, { rows: fresh }] = await Promise.all([
    pool.query("SELECT * FROM results WHERE child_id = $1 ORDER BY created_at", [child.id]),
    pool.query("SELECT achievement_id FROM child_achievements WHERE child_id = $1", [child.id]),
    pool.query("SELECT id, title, description FROM achievements ORDER BY reward_points, id"),
    pool.query("SELECT quizzes, goal_met FROM daily_activity WHERE child_id = $1 AND day = $2", [child.id, dayInZone(new Date(), child.timezone)]),
    pool.query("SELECT subject, count(*)::int AS n FROM question_stats s JOIN questions q ON q.id = s.question_id WHERE s.child_id = $1 AND s.wrong_count > 0 AND NOT s.mastered GROUP BY subject", [child.id]),
    pool.query("SELECT r.id, a.is_correct FROM results r JOIN quiz_answers a ON a.session_id = r.session_id WHERE r.child_id = $1 ORDER BY r.created_at, a.position", [child.id]),
  ]);
  const unlockedIds = new Set(unlocked.map((u) => u.achievement_id));
  const quizzes = results.filter((r) => r.mode === "quiz");

  const byResult = new Map();
  for (const a of fresh) (byResult.get(a.id) ?? byResult.set(a.id, []).get(a.id)).push({ isCorrect: a.is_correct });
  const earnedSet = new Set();
  for (const answers of byResult.values()) replay(answers).earned.forEach((e) => earnedSet.add(e));

  const bySubject = {};
  for (const subject of subjects) {
    const list = quizzes.filter((r) => r.subject === subject);
    bySubject[subject] = {
      attempts: list.length,
      bestScore: list.length ? Math.max(...list.map((r) => r.points_awarded)) : 0,
      avgAccuracy: list.length ? Math.round(list.reduce((n, r) => n + r.accuracy, 0) / list.length) : 0,
      mistakesToReview: mistakes.find((m) => m.subject === subject)?.n ?? 0,
    };
  }
  return {
    totalPoints: results.reduce((n, r) => n + r.points_awarded, 0),
    balance: child.points_balance,
    xp: child.xp,
    level: child.level,
    streak: child.current_streak,
    bestStreak: child.best_streak,
    dailyGoal: { goal: child.daily_goal, done: today[0]?.quizzes ?? 0, met: today[0]?.goal_met ?? false },
    quizzes: quizzes.length,
    totalCorrect: results.reduce((n, r) => n + r.correct, 0),
    bySubject,
    rewards: [...earnedSet],
    achievements: catalog.map((a) => ({ id: a.id, title: loc(a.title, child.locale), description: loc(a.description, child.locale), unlocked: unlockedIds.has(a.id) })),
    recent: results
      .slice(-10)
      .reverse()
      .map((r) => ({
        id: r.id, grade: r.grade, subject: r.subject, mode: r.mode, total: r.total, correct: r.correct, incorrect: r.incorrect,
        score: r.points_awarded, maxScore: r.total * pointsPerCorrect(r.mode), accuracy: r.accuracy, bestStreak: r.best_streak,
        equipped: [], earned: replay(byResult.get(r.id) ?? []).earned, durationSec: r.duration_sec, createdAt: r.created_at.toISOString(),
      })),
  };
}
