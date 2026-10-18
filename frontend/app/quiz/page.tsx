"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppHeader, Alert, Button, Card, PageLoader, btnClass } from "@/components/ui";
import { MascotView } from "@/components/MascotView";
import type { Mood, Reaction } from "@/components/three/Mascot";
import { REWARDS, SUBJECT_BY_ID } from "@/lib/data";
import { api, type AnswerResult, type QuizQuestion, type QuizResult, type QuizState } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Session = { sessionId: string; total: number; questions: QuizQuestion[] };
const EMPTY: QuizState = { answered: 0, correct: 0, incorrect: 0, score: 0, streak: 0, equipped: [], earned: [] };
const LETTERS = ["A", "B", "C", "D"];

function message(r: QuizResult) {
  if (r.accuracy >= 85) return "Ajoyib! Sen juda yaxshi ishlading!";
  if (r.accuracy >= 60) return "Barakalla! Biliming kundan-kunga oshmoqda!";
  return "Yaxshi harakat! Yana bir bor urinib ko‘ramizmi?";
}

export default function QuizPage() {
  const user = useRequireUser();
  const [session, setSession] = useState<Session | null>(null);
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

  const start = useCallback(async () => {
    if (!user) return;
    setError("");
    setSession(null);
    setResult(null);
    setReview(false);
    setFeedback(null);
    setIndex(0);
    setState(EMPTY);
    setMood("idle");
    try {
      const s = await api<Session>("/api/quiz/start", { method: "POST", body: { grade: user.profile.grade, subject: user.profile.subject } });
      setSession(s);
      setMoodFor("thinking", 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Testni boshlab bo‘lmadi");
    }
  }, [user, setMoodFor]);

  const initialized = useRef(false);
  useEffect(() => {
    if (user && !initialized.current) {
      initialized.current = true;
      start();
    }
  }, [user, start]);

  async function choose(answer: number) {
    if (!session || feedback || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const r = await api<AnswerResult>(`/api/quiz/${session.sessionId}/answer`, { method: "POST", body: { index, answer } });
      setFeedback({ ...r, chosen: answer });
      setState(r.state);
      const ev = r.event;
      setReaction((p) => ({ kind: ev.type, item: "item" in ev ? ev.item : null, nonce: p.nonce + 1 }));
      if (r.correct) setMoodFor(ev.type === "celebrate" || r.state.streak >= 5 ? "celebrating" : "happy", 1900);
      else setMoodFor("sad", 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Javobni yuborib bo‘lmadi");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  async function next() {
    if (!session) return;
    if (index + 1 < session.total) {
      setIndex((i) => i + 1);
      setFeedback(null);
      setMoodFor("thinking", 1200);
      return;
    }
    setSubmitting(true);
    try {
      const r = await api<{ result: QuizResult }>(`/api/quiz/${session.sessionId}/finish`, { method: "POST" });
      setResult(r.result);
      clearTimeout(moodTimer.current);
      setMood(r.result.accuracy >= 60 ? "celebrating" : r.result.equipped.length ? "wearing_rewards" : "idle");
      setReaction((p) => ({ kind: "celebrate", nonce: p.nonce + 1 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Natijani saqlab bo‘lmadi");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return <PageLoader />;
  const subj = SUBJECT_BY_ID[user.profile.subject!];
  const q = session?.questions[index];
  const mascotPanel = (
    <div className="rounded-4xl bg-linear-to-b from-blue-100 via-white to-white p-2 ring-1 ring-blue-100">
      <MascotView id={user.profile.mascot!} mood={mood} equipped={result ? result.equipped : state.equipped} reaction={reaction} className="h-56 sm:h-72 lg:h-[440px]" />
      <div className="flex min-h-10 flex-wrap justify-center gap-1.5 p-2" aria-label="Kiyilgan mukofotlar">
        {(result ? result.equipped : state.equipped).map((r) => (
          <motion.span key={r} initial={{ scale: 0 }} animate={{ scale: 1 }} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-blue-100">
            {REWARDS[r].emoji} {REWARDS[r].title}
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
              <button className="underline" onClick={start}>
                Qayta urinish
              </button>
            </Alert>
          )}
          {!session && !error && <PageLoader />}

          {session && q && !result && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-600">
                <span>
                  {subj.emoji} {subj.title} · {user.profile.grade}-sinf
                </span>
                <span className="flex gap-2">
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-blue-100">⭐ {state.score} ball</span>
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-blue-100">✅ {state.correct}</span>
                  {state.streak >= 2 && <span className="rounded-full bg-blue-600 px-3 py-1 text-white">🔥 {state.streak}</span>}
                </span>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm font-extrabold text-blue-800">
                  <span>
                    Savol {index + 1} / {session.total}
                  </span>
                  <span>{session.total - state.answered} ta savol qoldi</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-blue-100" role="progressbar" aria-valuemin={0} aria-valuemax={session.total} aria-valuenow={state.answered}>
                  <motion.div className="h-full rounded-full bg-blue-600" animate={{ width: `${(state.answered / session.total) * 100}%` }} />
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={q.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
                  <Card>
                    <h1 className="whitespace-pre-line text-xl font-extrabold leading-relaxed text-blue-950 sm:text-2xl">{q.prompt}</h1>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {q.options.map((o, i) => {
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
                              {feedback.correct ? "✓ To‘g‘ri javob! +10 ball" : "✗ Yana bir bor urinib ko‘r! Xatolardan o‘rganamiz."}
                            </p>
                            <p className="mt-1 text-slate-700">{feedback.explanation}</p>
                            {feedback.event.type === "equip" && <p className="mt-1 font-bold text-blue-700">🎁 Yangi mukofot: {REWARDS[feedback.event.item].emoji} {REWARDS[feedback.event.item].title}</p>}
                            {feedback.event.type === "remove" && feedback.event.item && (
                              <p className="mt-1 font-bold text-slate-600">
                                {REWARDS[feedback.event.item].emoji} {REWARDS[feedback.event.item].title} vaqtincha yechildi — keyingi to‘g‘ri javob bilan qaytarasan!
                              </p>
                            )}
                          </div>
                          <Button className="mt-4 w-full sm:w-auto" onClick={next} loading={submitting} autoFocus>
                            {index + 1 < session.total ? "Keyingi savol →" : "Natijalarni ko‘rish"}
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
                <h1 className="mt-2 text-3xl font-black text-blue-950">{message(result)}</h1>
                <p className="mt-4 text-6xl font-black text-blue-600">
                  {result.score}
                  <span className="text-2xl text-slate-400"> / {result.maxScore}</span>
                </p>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-emerald-50 p-3">
                    <div className="text-2xl font-black text-emerald-700">{result.correct}/20</div>
                    <div className="text-xs font-bold text-slate-500">To‘g‘ri</div>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-3">
                    <div className="text-2xl font-black text-amber-700">{result.incorrect}</div>
                    <div className="text-xs font-bold text-slate-500">Noto‘g‘ri</div>
                  </div>
                  <div className="rounded-2xl bg-blue-50 p-3">
                    <div className="text-2xl font-black text-blue-700">{result.accuracy}%</div>
                    <div className="text-xs font-bold text-slate-500">Aniqlik</div>
                  </div>
                </div>
                {result.earned.length > 0 && (
                  <p className="mt-4 font-bold text-slate-600">
                    Yutilgan mukofotlar: {result.earned.map((r) => `${REWARDS[r].emoji} ${REWARDS[r].title}`).join(", ")}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button onClick={start}>Qayta boshlash</Button>
                  {result.incorrect > 0 && (
                    <Button variant="secondary" onClick={() => setReview(true)}>
                      Xatolarni ko‘rish
                    </Button>
                  )}
                  <Link href="/dashboard" className={btnClass("secondary")}>
                    Bosh sahifaga qaytish
                  </Link>
                </div>
              </Card>
            </motion.div>
          )}

          {result && review && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h1 className="text-2xl font-black text-blue-950">Xatolar ustida ishlaymiz</h1>
                <Button variant="ghost" onClick={() => setReview(false)}>
                  ← Natijalar
                </Button>
              </div>
              <ol className="space-y-3">
                {result.answers!.filter((a) => a.chosen !== a.correctIndex).map((a) => (
                  <li key={a.questionId} className="rounded-2xl bg-blue-50/60 p-4 ring-1 ring-blue-100">
                    <p className="whitespace-pre-line font-extrabold text-blue-950">{a.prompt}</p>
                    <p className="mt-2 text-red-700">✗ Sening javobing: {a.options[a.chosen]}</p>
                    <p className="text-emerald-700">✓ To‘g‘ri javob: {a.options[a.correctIndex]}</p>
                    <p className="mt-1 text-sm text-slate-600">💡 {a.explanation}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={start}>Qayta boshlash</Button>
                <Link href="/dashboard" className={btnClass("secondary")}>
                  Bosh sahifaga qaytish
                </Link>
              </div>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
