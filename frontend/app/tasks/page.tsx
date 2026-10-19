"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppHeader, Alert, Button, Card, PageLoader } from "@/components/ui";
import { api, type DailyData, type WeeklyData } from "@/lib/api";
import { useAuth, useRequireUser } from "@/lib/auth";
import { confetti, playSound } from "@/lib/effects";

const LETTERS = ["A", "B", "C", "D"];

export default function TasksPage() {
  const user = useRequireUser();
  const { refresh } = useAuth();
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const sound = user?.child?.soundEnabled ?? true;

  const load = useCallback(async () => {
    try {
      const [d, w] = await Promise.all([api<DailyData>("/api/daily"), api<WeeklyData>("/api/weekly")]);
      setDaily(d);
      setWeekly(w);
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Yuklab bo‘lmadi" });
    }
  }, []);

  useEffect(() => {
    if (user) queueMicrotask(load);
  }, [user, load]);

  async function answer(i: number) {
    setBusy("daily");
    setMessage(null);
    try {
      const r = await api<DailyData>("/api/daily/answer", { method: "POST", body: { answer: i } });
      setDaily(r);
      if (r.result?.correct) {
        playSound("win", sound);
        confetti(1);
      } else playSound("wrong", sound);
      if (r.newAchievements?.length) setMessage({ tone: "info", text: `🏅 Yangi yutuq: ${r.newAchievements.map((a) => a.title).join(", ")}` });
      await Promise.all([refresh(), load()]);
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Javobni yuborib bo‘lmadi" });
    } finally {
      setBusy(null);
    }
  }

  async function claim(id: string) {
    setBusy(id);
    setMessage(null);
    try {
      const r = await api<WeeklyData>(`/api/weekly/${id}/claim`, { method: "POST" });
      setWeekly(r);
      playSound("coin", sound);
      confetti(0.7);
      setMessage({ tone: "info", text: `🎁 +${r.earned} ball olindi!${r.newAchievements?.length ? ` Yutuq: ${r.newAchievements.map((a) => a.title).join(", ")}` : ""}` });
      await refresh();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Mukofotni olib bo‘lmadi" });
    } finally {
      setBusy(null);
    }
  }

  if (!user) return <PageLoader />;
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <h1 className="text-3xl font-black text-blue-950">🎯 Vazifalar</h1>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {!daily && !message && <PageLoader />}

        {daily && (
          <section aria-labelledby="daily-title">
            <Card>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 id="daily-title" className="text-xl font-black text-blue-950">
                  ⚡ Kun savoli
                </h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">To‘g‘ri javob uchun +{daily.points} ball</span>
              </div>
              <p className="whitespace-pre-line text-lg font-extrabold text-blue-950">{daily.question.prompt}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {daily.question.options.map((o, i) => {
                  const res = daily.result;
                  const isRight = res && i === res.correctIndex;
                  const isWrong = res && i === res.chosen && !res.correct;
                  return (
                    <button
                      key={i}
                      onClick={() => answer(i)}
                      disabled={daily.answered || busy === "daily"}
                      className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-bold ring-2 transition disabled:cursor-default ${
                        isRight ? "bg-emerald-50 text-emerald-800 ring-emerald-500" : isWrong ? "bg-red-50 text-red-800 ring-red-400" : res ? "bg-white text-slate-400 ring-slate-100" : "bg-white text-slate-800 ring-blue-100 hover:bg-blue-50 hover:ring-blue-400"
                      }`}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-100 text-sm font-black text-blue-700">{isRight ? "✓" : isWrong ? "✗" : LETTERS[i]}</span>
                      {o}
                    </button>
                  );
                })}
              </div>
              {daily.result && (
                <div className={`mt-4 rounded-2xl p-4 ${daily.result.correct ? "bg-emerald-50" : "bg-amber-50"}`} role="status">
                  <p className="font-black">{daily.result.correct ? `✓ To‘g‘ri! +${daily.result.earned} ball` : "✗ Bu safar bo‘lmadi. Ertaga yangi savol!"}</p>
                  <p className="text-slate-700">{daily.result.explanation}</p>
                </div>
              )}
            </Card>
          </section>
        )}

        {weekly && (
          <section aria-labelledby="weekly-title">
            <Card>
              <h2 id="weekly-title" className="mb-1 text-xl font-black text-blue-950">
                📅 Haftalik topshiriqlar
              </h2>
              <p className="mb-3 text-sm text-slate-500">Hafta dushanbadan boshlanadi. Hammasini bajarsangiz, “Hafta qahramoni” yutug‘ini olasiz.</p>
              <ul className="space-y-3 p-0">
                {weekly.tasks.map((t) => (
                  <motion.li key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="list-none rounded-2xl bg-blue-50/60 p-3 ring-1 ring-blue-100">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-extrabold text-blue-950">{t.title}</span>
                      <span className="text-sm font-black text-amber-700">+{t.reward} ball</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-blue-100" role="progressbar" aria-valuemin={0} aria-valuemax={t.target} aria-valuenow={t.progress}>
                        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${(t.progress / t.target) * 100}%` }} />
                      </div>
                      <span className="w-14 text-right text-sm font-bold text-slate-600">
                        {t.progress}/{t.target}
                      </span>
                      {t.claimed ? (
                        <span className="rounded-xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-800">✓ Olindi</span>
                      ) : (
                        <Button className="!min-h-10 !px-4 !text-sm" disabled={!t.complete} loading={busy === t.id} onClick={() => claim(t.id)}>
                          Olish
                        </Button>
                      )}
                    </div>
                  </motion.li>
                ))}
              </ul>
            </Card>
          </section>
        )}
      </main>
    </>
  );
}
