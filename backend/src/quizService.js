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
import { awardAchievement } from "./rewards.js";
import { TESTS, TEST_BY_ID, UNLOCK_ACCURACY, levelTargetDifficulty, modeForTest, markFor } from "./tests.js";

const SESSION_TTL = "24 hours";
const DEADLINE_GRACE_MS = 5000; // imtihonda tarmoq kechikishi uchun qo‘shimcha vaqt
const SUBJECT_COUNT = 6;

// ---------- Yordamchilar ----------

/** Savol o‘quvchiga ko‘rsatiladigan shaklda (to‘g‘ri javobsiz). Variantlar tartibi sessiyaga bog‘liq. */
export function publicQuestion(q, sessionId, locale) {
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

export async function getQuestion(c, id) {
  const { rows } = await c.query("SELECT * FROM questions WHERE id = $1", [id]);
  return rows[0];
}

/** Maqsad qiyinlikka eng yaqin, bola uzoq vaqt ko‘rmagan savol. Tanlov serverda — mijoz ta’sir qila olmaydi. */
async function pickQuestion(c, { childId, grade, subject, used, target, allowed = null }) {
  const { rows } = await c.query(
    `SELECT q.id FROM questions q
       LEFT JOIN question_stats s ON s.child_id = $1 AND s.question_id = q.id
      WHERE q.active AND q.grade = $2 AND q.subject = $3 AND NOT (q.id = ANY($4::text[]))
        AND ($6::int[] IS NULL OR q.difficulty = ANY($6::int[]))
      ORDER BY abs(q.difficulty - $5), s.last_answered_at NULLS FIRST, random()
      LIMIT 1`,
    [childId, grade, subject, used, target, allowed],
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
  const state = publicState(replay(answers.map((a) => ({ isCorrect: a.is_correct }))), s.mode, s.test_id);
  const qid = s.question_ids[s.current_index];
  const question = qid && s.current_index < s.total ? publicQuestion(await getQuestion(c, qid), s.id, child.locale) : null;
  const test = TEST_BY_ID[s.test_id];
  return {
    sessionId: s.id,
    mode: s.mode,
    testId: s.test_id,
    testTitle: test?.title ?? "Xatolar ustida ishlash",
    pointsPerCorrect: pointsPerCorrect(s.mode, s.test_id),
    grade: s.grade,
    subject: s.subject,
    total: s.total,
    index: s.current_index,
    question,
    state,
    resumed,
    deadlineAt: s.deadline_at ? new Date(s.deadline_at).toISOString() : null,
    serverNow: new Date().toISOString(),
  };
}

// ---------- Boshlash / davom ettirish ----------

/** Bosqichli testlar ketma-ket ochiladi: oldingi bosqichda eng yaxshi aniqlik kamida UNLOCK_ACCURACY bo‘lishi kerak. */
async function assertUnlocked(c, child, grade, subject, test) {
  if (test.kind !== "level" || test.order === 1) return;
  const prev = TESTS.find((t) => t.kind === "level" && t.order === test.order - 1);
  const { rows } = await c.query(
    "SELECT coalesce(max(accuracy), -1)::int AS best FROM results WHERE child_id = $1 AND grade = $2 AND subject = $3 AND test_id = $4",
    [child.id, grade, subject, prev.id],
  );
  if (rows[0].best < UNLOCK_ACCURACY) throw new ApiError(403, `Avval "${prev.title}" bosqichini kamida ${UNLOCK_ACCURACY}% aniqlik bilan yakunlang`);
}

export async function startQuiz(child, { grade, subject, mode = "quiz", testId }) {
  const isMistakes = mode === "mistakes";
  const id = isMistakes ? "mistakes" : testId ?? (mode === "exam" ? "exam" : "mixed");
  const test = TEST_BY_ID[id];
  if (!isMistakes && !test) throw new ApiError(400, "Test turi noto‘g‘ri");
  const sessionMode = isMistakes ? "mistakes" : modeForTest(id);
  try {
    return await tx(async (c) => {
      await c.query("UPDATE quiz_sessions SET status = 'expired' WHERE child_id = $1 AND status = 'active' AND expires_at < now()", [child.id]);
      const existing = await c.query(
        "SELECT * FROM quiz_sessions WHERE child_id = $1 AND subject = $2 AND grade = $3 AND mode = $4 AND test_id = $5 AND status = 'active' FOR UPDATE",
        [child.id, subject, grade, sessionMode, id],
      );
      if (existing.rows[0]) return describe(c, existing.rows[0], child, true);

      let total;
      let ids;
      if (isMistakes) {
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
        await assertUnlocked(c, child, grade, subject, test);
        const { rows } = await c.query(
          "SELECT count(*)::int AS n FROM questions WHERE active AND grade = $1 AND subject = $2 AND difficulty = ANY($3::int[])",
          [grade, subject, test.difficulties],
        );
        if (!rows[0].n) throw new ApiError(404, "Bu sinf va fan uchun savollar topilmadi");
        total = Math.min(test.length, rows[0].n);
        const first = await pickQuestion(c, {
          childId: child.id, grade, subject, used: [],
          target: test.kind === "level" ? levelTargetDifficulty(test, 0, total) : targetDifficulty(0, total, 0),
          allowed: test.kind === "level" ? test.difficulties : null,
        });
        ids = [first];
      }
      const { rows } = await c.query(
        `INSERT INTO quiz_sessions (child_id, mode, test_id, grade, subject, total, question_ids, expires_at, deadline_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now() + interval '${SESSION_TTL}', CASE WHEN $8::int IS NULL THEN NULL ELSE now() + make_interval(secs => $8::int) END) RETURNING *`,
        [child.id, sessionMode, id, grade, subject, total, ids, test?.timeLimitSec ?? null],
      );
      return describe(c, rows[0], child, false);
    });
  } catch (err) {
    // Ikki parallel "start": unique indeks ikkinchisini rad etadi — mavjud sessiyani qaytaramiz.
    if (err.code === "23505") return startQuiz(child, { grade, subject, mode, testId });
    throw err;
  }
}

/** Sahifa yangilangandan keyin: faol sessiya bormi? (yaratmaydi) */
export async function activeQuiz(child, { grade, subject, mode = "quiz", testId }) {
  const id = mode === "mistakes" ? "mistakes" : testId ?? (mode === "exam" ? "exam" : "mixed");
  return tx(async (c) => {
    const { rows } = await c.query(
      "SELECT * FROM quiz_sessions WHERE child_id = $1 AND subject = $2 AND grade = $3 AND mode = $4 AND test_id = $5 AND status = 'active' AND expires_at > now()",
      [child.id, subject, grade, mode === "mistakes" ? "mistakes" : modeForTest(id), id],
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
    state: publicState(r, s.mode, s.test_id),
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
    if (s.deadline_at && Date.now() > new Date(s.deadline_at).getTime() + DEADLINE_GRACE_MS) throw new ApiError(410, "Vaqt tugadi. Natijani yakunlang.");
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
    if (s.mode !== "mistakes") {
      const test = TEST_BY_ID[s.test_id];
      if (test.kind === "mixed") ({ correctStreak: cs, wrongStreak: ws, offset } = adapt({ correctStreak: cs, wrongStreak: ws, offset }, isCorrect));
      if (index + 1 < total) {
        nextId = await pickQuestion(c, {
          childId: child.id, grade: s.grade, subject: s.subject, used: ids,
          target: test.kind === "level" ? levelTargetDifficulty(test, index + 1, total) : targetDifficulty(index + 1, total, offset),
          allowed: test.kind === "level" ? test.difficulties : null,
        });
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
            bool_or(mode IN ('quiz', 'exam') AND correct = total AND test_id NOT IN ('level-1', 'level-2')) AS perfect,
            coalesce(max(best_streak) FILTER (WHERE test_id NOT IN ('level-1', 'level-2', 'mistakes')), 0)::int AS best_answer_streak,
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
    testId: row.test_id,
    testTitle: TEST_BY_ID[row.test_id]?.title ?? "Xatolar ustida ishlash",
    mark: row.mark,
    total: row.total,
    correct: row.correct,
    incorrect: row.incorrect,
    score: row.points_awarded,
    maxScore: row.total * pointsPerCorrect(row.mode, row.test_id),
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
    // Imtihonda vaqt tugagan bo‘lsa, javob berilmagan savollar noto‘g‘ri hisoblanadi; boshqa testlarda hammasiga javob berish shart.
    const timedOut = Boolean(s.deadline_at) && Date.now() > new Date(s.deadline_at).getTime();
    if (answers.length < s.total && !timedOut) throw new ApiError(409, "Avval barcha savollarga javob bering");

    const r = replay(answers.map((a) => ({ isCorrect: a.is_correct })));
    const accuracy = Math.round((r.correct / s.total) * 100);
    const points = r.correct * pointsPerCorrect(s.mode, s.test_id);
    const xp = points + COMPLETION_XP;
    const durationSec = Math.max(0, Math.round((Date.now() - new Date(s.started_at).getTime()) / 1000));

    const inserted = await c.query(
      `INSERT INTO results (session_id, child_id, mode, test_id, mark, grade, subject, total, correct, incorrect, accuracy, best_streak, points_awarded, xp_awarded, duration_sec)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (session_id) DO NOTHING RETURNING *`,
      [s.id, child.id, s.mode, s.test_id, s.mode === "exam" ? markFor(accuracy) : null, s.grade, s.subject, s.total, r.correct, s.total - r.correct, accuracy, r.bestStreak, points, xp, durationSec],
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

    // Daraja va imtihon yutuqlari (ball yangilangandan keyin beriladi).
    const extra = [];
    if (levelForXp(newXp) >= 5) extra.push(await awardAchievement(c, child.id, "level5", child.locale));
    if (inserted.rows[0].mark >= 4) extra.push(await awardAchievement(c, child.id, "exam4", child.locale));

    const titles = (await c.query("SELECT id, title, description FROM achievements WHERE id = ANY($1::text[])", [unlocked.map((a) => a.id)])).rows;
    return {
      result: await resultView(c, inserted.rows[0], child),
      newAchievements: [...titles.map((t) => ({ id: t.id, title: loc(t.title, child.locale), description: loc(t.description, child.locale) })), ...extra.filter(Boolean)],
      streak: streak.current,
      level: levelForXp(newXp),
      state: publicState(r, s.mode, s.test_id),
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

/**
 * Progress. Statistika va natijalar TANLANGAN SINF bo‘yicha (boshqa sinf natijalari aralashmaydi);
 * ball, daraja, yutuqlar va seriya esa umumiy (o‘yin yutuqlari sinfga bog‘liq emas).
 */
export async function getProgress(child, subjects) {
  const [{ rows: allResults }, { rows: unlocked }, { rows: catalog }, { rows: today }, { rows: mistakes }, { rows: fresh }] = await Promise.all([
    pool.query("SELECT * FROM results WHERE child_id = $1 ORDER BY created_at", [child.id]),
    pool.query("SELECT achievement_id FROM child_achievements WHERE child_id = $1", [child.id]),
    pool.query("SELECT id, title, description FROM achievements ORDER BY reward_points, id"),
    pool.query("SELECT quizzes, goal_met FROM daily_activity WHERE child_id = $1 AND day = $2", [child.id, dayInZone(new Date(), child.timezone)]),
    pool.query("SELECT subject, count(*)::int AS n FROM question_stats s JOIN questions q ON q.id = s.question_id WHERE s.child_id = $1 AND s.wrong_count > 0 AND NOT s.mastered AND ($2::int IS NULL OR q.grade = $2) GROUP BY subject", [child.id, child.grade ?? null]),
    pool.query("SELECT r.id, a.is_correct FROM results r JOIN quiz_answers a ON a.session_id = r.session_id WHERE r.child_id = $1 ORDER BY r.created_at, a.position", [child.id]),
  ]);
  const unlockedIds = new Set(unlocked.map((u) => u.achievement_id));
  const results = child.grade ? allResults.filter((r) => r.grade === child.grade) : allResults;
  const quizzes = results.filter((r) => r.mode === "quiz");

  const byResult = new Map();
  for (const a of fresh) (byResult.get(a.id) ?? byResult.set(a.id, []).get(a.id)).push({ isCorrect: a.is_correct });
  const earnedSet = new Set();
  for (const r of results) replay(byResult.get(r.id) ?? []).earned.forEach((e) => earnedSet.add(e)); // faqat tanlangan sinf natijalari

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
    grade: child.grade,
    totalPoints: allResults.reduce((n, r) => n + r.points_awarded, 0),
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
        testId: r.test_id, mark: r.mark, score: r.points_awarded, maxScore: r.total * pointsPerCorrect(r.mode, r.test_id), accuracy: r.accuracy, bestStreak: r.best_streak,
        equipped: [], earned: replay(byResult.get(r.id) ?? []).earned, durationSec: r.duration_sec, createdAt: r.created_at.toISOString(),
      })),
  };
}

// ---------- Test katalogi ----------

/** Tanlangan sinf va fan uchun barcha testlar: holati, eng yaxshi natija, ochiqligi, davom etayotgan sessiya. */
export async function listTests(child, { grade, subject }) {
  const [pool_, stats, active] = await Promise.all([
    pool.query("SELECT difficulty, count(*)::int AS n FROM questions WHERE active AND grade = $1 AND subject = $2 GROUP BY difficulty", [grade, subject]),
    pool.query(
      `SELECT test_id, count(*)::int AS attempts, max(accuracy)::int AS best_accuracy, max(points_awarded)::int AS best_score, max(mark)::int AS best_mark
         FROM results WHERE child_id = $1 AND grade = $2 AND subject = $3 AND mode IN ('quiz', 'exam') GROUP BY test_id`,
      [child.id, grade, subject],
    ),
    pool.query(
      "SELECT test_id, current_index, total FROM quiz_sessions WHERE child_id = $1 AND grade = $2 AND subject = $3 AND status = 'active' AND expires_at > now()",
      [child.id, grade, subject],
    ),
  ]);
  const count = new Map(pool_.rows.map((r) => [r.difficulty, r.n]));
  const stat = new Map(stats.rows.map((r) => [r.test_id, r]));
  const act = new Map(active.rows.map((r) => [r.test_id, r]));
  return TESTS.map((t) => {
    const available = t.difficulties.reduce((n, d) => n + (count.get(d) ?? 0), 0);
    const st = stat.get(t.id);
    const prev = t.kind === "level" && t.order > 1 ? stat.get(TESTS.find((x) => x.kind === "level" && x.order === t.order - 1).id) : null;
    const unlocked = t.kind !== "level" || t.order === 1 || (prev?.best_accuracy ?? -1) >= UNLOCK_ACCURACY;
    return {
      id: t.id,
      kind: t.kind,
      order: t.order,
      title: t.title,
      label: t.label,
      note: t.note,
      total: Math.min(t.length, available),
      pointsPerCorrect: t.points,
      timeLimitSec: t.timeLimitSec ?? null,
      available: available > 0,
      unlocked,
      lockedReason: unlocked ? null : `Oldingi bosqichni kamida ${UNLOCK_ACCURACY}% bilan yakunlang`,
      attempts: st?.attempts ?? 0,
      bestAccuracy: st?.best_accuracy ?? null,
      bestScore: st?.best_score ?? null,
      bestMark: st?.best_mark ?? null,
      inProgress: act.has(t.id) ? { answered: act.get(t.id).current_index, total: act.get(t.id).total } : null,
    };
  });
}
