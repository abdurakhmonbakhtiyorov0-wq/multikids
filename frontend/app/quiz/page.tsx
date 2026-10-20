"use client";

import { useContentT, useT } from "@/lib/i18n";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppHeader, Alert, Button, Card, PageLoader, btnClass } from "@/components/ui";
import { MascotView } from "@/components/MascotView";
import type { Mood, Reaction } from "@/components/three/Mascot";
import { REWARDS, SUBJECT_BY_ID } from "@/lib/data";
import { confetti, playSound } from "@/lib/effects";
import { speechLang, useSpeech } from "@/lib/speech";
import { useOnline } from "@/lib/online";
import { api, ApiError, type NewAchievement, type AnswerResult, type QuizMode, type QuizQuestion, type QuizResult, type QuizSession, type QuizState, type TestId } from "@/lib/api";
import { useAuth, useRequireUser } from "@/lib/auth";

const EMPTY: QuizState = { answered: 0, correct: 0, incorrect: 0, score: 0, streak: 0, equipped: [], earned: [] };
const LETTERS = ["A", "B", "C", "D"];

function message(r: QuizResult, t: (s: string) => string) {
  if (r.accuracy >= 85) return t("Ajoyib! Sen juda yaxshi ishlading!");
  if (r.accuracy >= 60) return t("Barakalla! Biliming kundan-kunga oshmoqda!");
  return t("Yaxshi harakat! Yana bir bor urinib ko‘ramizmi?");
}

export default function QuizPage() {
  const t = useT();
  const user = useRequireUser();
  const { refresh } = useAuth();
  const ct = useContentT(user?.profile.subject);
  const online = useOnline();
  const [pending, setPending] = useState<number | null>(null);
  const speech = useSpeech(speechLang(user?.profile.subject ?? "mathematics"));
  const { available: canSpeak, speak, stop } = speech;
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  });
  const [bonus, setBonus] = useState<{ achievements: NewAchievement[]; level?: number; leveledUp: boolean; streak?: number } | null>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [q, setQ] = useState<QuizQuestion | null>(null);
  const [total, setTotal] = useState(20);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<QuizState>(EMPTY);
  const [feedback, setFeedback] = useState<(AnswerResult & { chosen: number }) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const [reaction, setReaction] = useState<Reaction>({ kind: "none", nonce: 0 });
  const [result, setResult] = useState<QuizResult | null>(null);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const moodTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inFlight = useRef(false);

  const setMoodFor = useCallback((m: Mood, ms: number, after: Mood = "idle") => {
    clearTimeout(moodTimer.current);
    setMood(m);
    moodTimer.current = setTimeout(() => setMood(after), ms);
  }, []);
  useEffect(() => () => clearTimeout(moodTimer.current), []);

  const targetRef = useRef<{ mode: QuizMode; testId?: TestId }>({ mode: "quiz" });
  const [remaining, setRemaining] = useState<number | null>(null);

  const finish = useCallback(async (sessionId: string) => {
    setSubmitting(true);
    try {
      type Finish = { result: QuizResult; newAchievements?: NewAchievement[]; level?: number; streak?: number };
      let r: Finish;
      try {
        r = await api<Finish>(`/api/quiz/${sessionId}/finish`, { method: "POST" });
      } catch (e) {
        // Imtihon vaqti tugagan lahzada soat farqi tufayli server biroz erta deb hisoblashi mumkin — bir marta qayta urinamiz.
        if (!(e instanceof ApiError) || e.status !== 409) throw e;
        await new Promise((res) => setTimeout(res, 2500));
        r = await api<Finish>(`/api/quiz/${sessionId}/finish`, { method: "POST" });
      }
      const sound = userRef.current?.child?.soundEnabled ?? true;
      const before = userRef.current?.child?.level ?? 1;
      const leveledUp = (r.level ?? before) > before;
      setBonus({ achievements: r.newAchievements ?? [], level: r.level, leveledUp, streak: r.streak });
      if (leveledUp) {
        playSound("levelup", sound);
        confetti(2);
      } else if (r.result.accuracy >= 60) {
        playSound("win", sound);
        confetti(r.result.accuracy >= 90 ? 1.5 : 1);
      }
      void refresh();
      setResult(r.result);
      clearTimeout(moodTimer.current);
      setMood(r.result.accuracy >= 60 ? "celebrating" : r.result.equipped.length ? "wearing_rewards" : "idle");
      setReaction((p) => ({ kind: "celebrate", nonce: p.nonce + 1 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Natijani saqlab bo‘lmadi"));
    } finally {
      setSubmitting(false);
    }
  }, [refresh, t]);

  const start = useCallback(async (mode: QuizMode = "quiz", testId?: TestId) => {
    if (!user) return;
    targetRef.current = { mode, testId };
    setRemaining(null);
    setError("");
    setSession(null);
    setQ(null);
    setResult(null);
    setBonus(null);
    setReview(false);
    setFeedback(null);
    setIndex(0);
    setState(EMPTY);
    setMood("idle");
    try {
      const s = await api<QuizSession>("/api/quiz/start", { method: "POST", body: { grade: user.profile.grade, subject: user.profile.subject, mode, testId } });
      setSession(s);
      setQ(s.question);
      setTotal(s.total);
      setIndex(s.index);
      setState(s.state);
      if (s.deadlineAt) setRemaining(Math.max(0, Math.round((new Date(s.deadlineAt).getTime() - new Date(s.serverNow).getTime()) / 1000)));
      if (!s.question) await finish(s.sessionId);
      setMoodFor("thinking", 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Testni boshlab bo‘lmadi"));
    }
  }, [user, setMoodFor, finish, t]);

  const initialized = useRef(false);
  useEffect(() => {
    if (user && !initialized.current) {
      initialized.current = true;
      const params = new URLSearchParams(window.location.search);
      const test = params.get("test") as TestId | null;
      queueMicrotask(() => {
        if (params.get("mode") === "mistakes") start("mistakes");
        else if (test) start(test === "exam" ? "exam" : "quiz", test);
        else start("quiz", "mixed");
      });
    }
  }, [user, start]);

  useEffect(() => {
    if (remaining === null || result || !session) return;
    const t = setTimeout(
      () => {
        if (remaining <= 0) finish(session.sessionId);
        else setRemaining(remaining - 1);
      },
      remaining <= 0 ? 0 : 1000,
    );
    return () => clearTimeout(t);
  }, [remaining, result, session, finish]);

  const readAloud = useCallback(
    (question: QuizQuestion) => speak(`${question.prompt.replace(/\n/g, ". ")}. ${question.options.join(". ")}.`),
    [speak],
  );
  const autoRead = user?.child?.voiceAutoplay ?? false;
  const currentId = q?.id;
  useEffect(() => {
    if (!q) return;
    if (autoRead && canSpeak && !result) readAloud(q);
    return () => stop();
    // faqat savol almashganda qayta ishga tushadi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, autoRead, canSpeak]);

  const chooseRef = useRef<(a: number) => Promise<void>>(async () => {});
  useEffect(() => {
    if (!online || pending === null) return;
    const answer = pending;
    queueMicrotask(() => {
      setPending(null);
      setError("");
      void chooseRef.current(answer);
    });
  }, [online, pending]);

  async function choose(answer: number) {
    if (!session || feedback || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const r = await api<AnswerResult>(`/api/quiz/${session.sessionId}/answer`, { method: "POST", body: { index, answer } });
      playSound(r.correct ? "correct" : "wrong", user?.child?.soundEnabled ?? true);
      setFeedback({ ...r, chosen: answer });
      setState(r.state);
      if (r.total) setTotal(r.total);
      const ev = r.event;
      setReaction((p) => ({ kind: ev.type, item: "item" in ev ? ev.item : null, nonce: p.nonce + 1 }));
      if (r.correct) setMoodFor(ev.type === "celebrate" || r.state.streak >= 5 ? "celebrating" : "happy", 1900);
      else setMoodFor("sad", 2000);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        // Tarmoq yo‘q: javob serverga yetmadi, "to‘g‘ri" deb ko‘rsatmaymiz. Aloqa tiklangach o‘zi qayta yuboriladi (server takroriy javobni ikki marta hisoblamaydi).
        setPending(answer);
        setError(t("Internet yo‘q — javobingiz hali yuborilmadi. Aloqa tiklangach avtomatik yuboriladi."));
      } else if (e instanceof ApiError && e.status === 410 && session.deadlineAt) await finish(session.sessionId);
      else setError(e instanceof Error ? e.message : t("Javobni yuborib bo‘lmadi"));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  useEffect(() => {
    chooseRef.current = choose;
  });

  async function next() {
    if (!session) return;
    if (feedback?.next) {
      setQ(feedback.next);
      setIndex((i) => i + 1);
      setFeedback(null);
      setMoodFor("thinking", 1200);
      return;
    }
    await finish(session.sessionId);
  }

  if (!user) return <PageLoader />;
  const subj = SUBJECT_BY_ID[user.profile.subject!];
  const levelNo = result?.testId?.startsWith("level-") ? Number(result.testId.slice(6)) : 0;
  const nextLevel: TestId | null = result && levelNo > 0 && levelNo < 5 && result.accuracy >= 60 ? (`level-${levelNo + 1}` as TestId) : null;
  const mascotPanel = (
    <div className="rounded-4xl bg-linear-to-b from-blue-100 via-white to-white p-2 ring-1 ring-blue-100">
      <MascotView id={user.profile.mascot!} mood={mood} equipped={result ? result.equipped : state.equipped} reaction={reaction} className="h-56 sm:h-72 lg:h-[440px]" />
      <div className="flex min-h-10 flex-wrap justify-center gap-1.5 p-2" aria-label={t("Kiyilgan mukofotlar")}>
        {(result ? result.equipped : state.equipped).map((r) => (
          <motion.span key={r} initial={{ scale: 0 }} animate={{ scale: 1 }} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-blue-100">
            {REWARDS[r].emoji} {t(REWARDS[r].title)}
          </motion.span>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-5 px-4 py-5 lg:grid-cols-[1fr_400px]">
        <div className="lg:order-2">{mascotPanel}</div>
        <div className="space-y-4 lg:order-1">
          {error && (
            <Alert>
              {error}{" "}
              <button className="underline" onClick={() => start(targetRef.current.mode, targetRef.current.testId)}>
                {t("Qayta urinish")}
              </button>
            </Alert>
          )}
          {!session && !error && <PageLoader />}

          {session && q && !result && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-600">
                <span>
                  {subj.emoji} {t(subj.title)} · {t("{n}-sinf", { n: user.profile.grade })} · {t(session.testTitle)}
                </span>
                <span className="flex gap-2">
                  {remaining !== null && (
                    <span className={`rounded-full px-3 py-1 ring-1 ${remaining <= 60 ? "bg-red-50 text-red-700 ring-red-200" : "bg-white ring-blue-100"}`} role="timer" aria-label={t("Qolgan vaqt")}>
                      ⏱ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
                    </span>
                  )}
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-blue-100">{t("⭐ {n} ball", { n: state.score })}</span>
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-blue-100">✅ {state.correct}</span>
                  {state.streak >= 2 && <span className="rounded-full bg-blue-600 px-3 py-1 text-white">🔥 {state.streak}</span>}
                </span>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm font-extrabold text-blue-800">
                  <span>
                    {t("Savol {i} / {n}", { i: index + 1, n: total })}
                  </span>
                  <span>{t("{n} ta savol qoldi", { n: total - state.answered })}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-blue-100" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={state.answered}>
                  <motion.div className="h-full rounded-full bg-blue-600" animate={{ width: `${(state.answered / total) * 100}%` }} />
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={q.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
                  <Card>
                    <div className="flex items-start gap-3">
                      {!canSpeak && (
                        <span
                          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-100 text-2xl opacity-60 ring-2 ring-slate-200"
                          role="img"
                          aria-label={t("Bu qurilmada o‘qish uchun ovoz topilmadi")}
                          title={t("Bu qurilmada o‘qish uchun ovoz topilmadi")}
                        >
                          🔇
                        </span>
                      )}
                      {canSpeak && (
                        <button
                          type="button"
                          onClick={() => (speech.speaking ? stop() : readAloud(q))}
                          aria-label={speech.speaking ? t("O‘qishni to‘xtatish") : t("Savolni ovoz chiqarib o‘qish")}
                          aria-pressed={speech.speaking}
                          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-100 text-2xl text-blue-700 ring-2 ring-blue-200 transition hover:bg-blue-200 active:scale-95"
                        >
                          {speech.speaking ? "⏹" : "🔊"}
                        </button>
                      )}
                      <h1 className="whitespace-pre-line text-xl font-extrabold leading-relaxed text-blue-950 sm:text-2xl">{ct(q.prompt)}</h1>
                    </div>
                    {q.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={q.image.src} alt={q.image.alt} loading="lazy" decoding="async" className="mx-auto mt-4 max-h-56 rounded-2xl bg-blue-50 p-2" />
                    )}
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {q.options.map((o0, i) => {
                        const o = ct(o0);
                        const isCorrect = feedback && i === feedback.correctIndex;
                        const isWrongPick = feedback && i === feedback.chosen && !feedback.correct;
                        return (
                          <button
                            key={i}
                            onClick={() => choose(i)}
                            disabled={!!feedback || submitting}
                            className={`flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-bold ring-2 transition disabled:cursor-default ${
                              isCorrect
                                ? "bg-emerald-50 text-emerald-800 ring-emerald-500"
                                : isWrongPick
                                  ? "bg-red-50 text-red-800 ring-red-400"
                                  : feedback
                                    ? "bg-white text-slate-400 ring-slate-100"
                                    : "bg-white text-slate-800 ring-blue-100 hover:-translate-y-0.5 hover:bg-blue-50 hover:ring-blue-400"
                            }`}
                          >
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base font-black ${isCorrect ? "bg-emerald-500 text-white" : isWrongPick ? "bg-red-500 text-white" : "bg-blue-100 text-blue-700"}`}>
                              {isCorrect ? "✓" : isWrongPick ? "✗" : LETTERS[i]}
                            </span>
                            {o}
                          </button>
                        );
                      })}
                    </div>

                    <AnimatePresence>
                      {feedback && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
                          <div className={`mt-5 rounded-2xl p-4 ${feedback.correct ? "bg-emerald-50" : "bg-amber-50"}`} role="status" aria-live="polite">
                            <p className={`text-lg font-black ${feedback.correct ? "text-emerald-700" : "text-amber-700"}`}>
                              {feedback.correct ? t("✓ To‘g‘ri javob! +{n} ball", { n: session.pointsPerCorrect }) : t("✗ Yana bir bor urinib ko‘r! Xatolardan o‘rganamiz.")}
                            </p>
                            <p className="mt-1 text-slate-700">{ct(feedback.explanation)}</p>
                            {feedback.event.type === "equip" && <p className="mt-1 font-bold text-blue-700">{t("🎁 Yangi mukofot:")} {REWARDS[feedback.event.item].emoji} {t(REWARDS[feedback.event.item].title)}</p>}
                            {feedback.event.type === "remove" && feedback.event.item && (
                              <p className="mt-1 font-bold text-slate-600">
                                {REWARDS[feedback.event.item].emoji} {t("{name} vaqtincha yechildi — keyingi to‘g‘ri javob bilan qaytarasan!", { name: t(REWARDS[feedback.event.item].title) })}
                              </p>
                            )}
                          </div>
                          <Button className="mt-4 w-full sm:w-auto" onClick={next} loading={submitting} autoFocus>
                            {feedback.next ? t("Keyingi savol →") : t("Natijalarni ko‘rish")}
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              </AnimatePresence>
            </>
          )}

          {result && !review && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="text-center">
                <p className="text-5xl">{result.accuracy >= 85 ? "🏆" : result.accuracy >= 60 ? "🌟" : "💪"}</p>
                {result.testTitle && <p className="mt-2 text-sm font-extrabold uppercase tracking-wide text-blue-600">{result.testTitle}</p>}
                <h1 className="mt-1 text-3xl font-black text-blue-950">{message(result, t)}</h1>
                {result.mark ? (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-violet-100 px-5 py-2 text-2xl font-black text-violet-800">{t("Baho:")} {result.mark}</p>
                ) : null}
                <p className="mt-4 text-6xl font-black text-blue-600">
                  {result.score}
                  <span className="text-2xl text-slate-400"> / {result.maxScore}</span>
                </p>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-emerald-50 p-3">
                    <div className="text-2xl font-black text-emerald-700">{result.correct}/{result.total}</div>
                    <div className="text-xs font-bold text-slate-500">{t("To‘g‘ri")}</div>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-3">
                    <div className="text-2xl font-black text-amber-700">{result.incorrect}</div>
                    <div className="text-xs font-bold text-slate-500">{t("Noto‘g‘ri")}</div>
                  </div>
                  <div className="rounded-2xl bg-blue-50 p-3">
                    <div className="text-2xl font-black text-blue-700">{result.accuracy}%</div>
                    <div className="text-xs font-bold text-slate-500">{t("Aniqlik")}</div>
                  </div>
                </div>
                {bonus && (bonus.leveledUp || bonus.achievements.length > 0 || (bonus.streak ?? 0) > 1) && (
                  <div className="mt-4 space-y-1 rounded-2xl bg-amber-50 p-3 text-left font-bold text-amber-900" role="status">
                    {bonus.leveledUp && <p>{t("🆙 Yangi daraja: {n}-daraja!", { n: bonus.level ?? "" })}</p>}
                    {bonus.achievements.map((a) => (
                      <p key={a.id}>
                        {t("🏅 Yangi yutuq:")} {t(a.title)}
                        {a.rewardPoints ? ` (+${a.rewardPoints} ${t("ball")})` : ""}
                      </p>
                    ))}
                    {(bonus.streak ?? 0) > 1 && <p>{t("🔥 {n} kunlik seriya!", { n: bonus.streak ?? 0 })}</p>}
                  </div>
                )}
                {result.earned.length > 0 && (
                  <p className="mt-4 font-bold text-slate-600">
                    {t("Yutilgan mukofotlar:")} {result.earned.map((r) => `${REWARDS[r].emoji} ${t(REWARDS[r].title)}`).join(", ")}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button onClick={() => start(targetRef.current.mode, targetRef.current.testId)}>{t("Qayta boshlash")}</Button>
                  {result.incorrect > 0 && result.mode !== "mistakes" && (
                    <Button variant="secondary" onClick={() => start("mistakes")}>
                      {t("Xatolar ustida ishlash")}
                    </Button>
                  )}
                  {result.incorrect > 0 && (
                    <Button variant="secondary" onClick={() => setReview(true)}>
                      {t("Xatolarni ko‘rish")}
                    </Button>
                  )}
                  {nextLevel && (
                    <Button onClick={() => start("quiz", nextLevel)}>{t("Keyingi bosqich ▶")}</Button>
                  )}
                  <Link href="/tests" className={btnClass("secondary")}>
                    {t("Barcha testlar")}
                  </Link>
                  <Link href="/dashboard" className={btnClass("ghost")}>
                    {t("Bosh sahifa")}
                  </Link>
                </div>
              </Card>
            </motion.div>
          )}

          {result && review && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h1 className="text-2xl font-black text-blue-950">{t("Xatolar ustida ishlaymiz")}</h1>
                <Button variant="ghost" onClick={() => setReview(false)}>
                  {t("← Natijalar")}
                </Button>
              </div>
              <ol className="space-y-3">
                {result.answers!.filter((a) => a.chosen !== a.correctIndex).map((a) => (
                  <li key={a.questionId} className="rounded-2xl bg-blue-50/60 p-4 ring-1 ring-blue-100">
                    <p className="whitespace-pre-line font-extrabold text-blue-950">{ct(a.prompt)}</p>
                    <p className="mt-2 text-red-700">{t("✗ Sening javobing:")} {ct(a.options[a.chosen])}</p>
                    <p className="text-emerald-700">{t("✓ To‘g‘ri javob:")} {ct(a.options[a.correctIndex])}</p>
                    <p className="mt-1 text-sm text-slate-600">💡 {ct(a.explanation)}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={() => start(targetRef.current.mode, targetRef.current.testId)}>{t("Qayta boshlash")}</Button>
                <Link href="/dashboard" className={btnClass("secondary")}>
                  {t("Bosh sahifaga qaytish")}
                </Link>
              </div>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
