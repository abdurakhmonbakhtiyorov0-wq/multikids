"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppHeader, Alert, Card, PageLoader, btnClass } from "@/components/ui";
import { MascotView } from "@/components/MascotView";
import { CHARACTER_BY_ID, REWARDS, SUBJECT_BY_ID } from "@/lib/data";
import { api, type Progress } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

export default function Dashboard() {
  const user = useRequireUser();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api<Progress>("/api/progress")
      .then(setProgress)
      .catch((e) => setError(e.message));
  }, [user]);

  if (!user) return <PageLoader />;
  const { mascot, grade, subject } = user.profile as Required<typeof user.profile>;
  const subj = SUBJECT_BY_ID[subject!];
  const lastEquipped = progress?.recent[0]?.equipped ?? [];
  const subjectStats = progress?.bySubject[subject!];

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_420px]">
        <div className="order-2 space-y-5 lg:order-1">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-black text-blue-950 sm:text-4xl">Salom, {user.name}! 👋</h1>
            <p className="mt-1 text-lg text-slate-600">Bugun nimalarni o‘rganamiz?</p>
          </motion.div>
          {error && <Alert>{error}</Alert>}

          <Card className="bg-linear-to-br from-blue-600 to-blue-700 text-white ring-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
              <span className="rounded-full bg-white/20 px-3 py-1">{grade}-sinf</span>
              <span className="rounded-full bg-white/20 px-3 py-1">
                {subj.emoji} {subj.title}
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-black">Bilimingni sinab ko‘r!</h2>
            <p className="mt-1 text-blue-100">5 bosqichli testlar, aralash test va sinov imtihoni — har bir to‘g‘ri javob uchun ball va mukofot</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/tests" className="inline-flex min-h-12 items-center rounded-2xl bg-white px-6 font-extrabold text-blue-700 shadow-[0_5px_0_#93c5fd] transition hover:bg-blue-50 active:translate-y-[3px] active:shadow-[0_2px_0_#93c5fd]">
                {subjectStats?.attempts ? "Testlarni tanlash ▶" : "Testlarni ko‘rish ▶"}
              </Link>
              {!!subjectStats?.mistakesToReview && (
                <Link href="/quiz?mode=mistakes" className="inline-flex min-h-12 items-center rounded-2xl px-5 font-bold text-white ring-2 ring-white/50 hover:bg-white/10">
                  Xatolar ustida ishlash ({subjectStats.mistakesToReview})
                </Link>
              )}
              <Link href="/onboarding?step=subject" className="inline-flex min-h-12 items-center rounded-2xl px-5 font-bold text-white ring-2 ring-white/50 hover:bg-white/10">
                Boshqa fan tanlash
              </Link>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Jami ball", value: progress?.totalPoints ?? "–", icon: "⭐" },
              { label: "To‘g‘ri javoblar", value: progress?.totalCorrect ?? "–", icon: "✅" },
              { label: "Testlar", value: progress?.quizzes ?? "–", icon: "📝" },
            ].map((s) => (
              <Card key={s.label} className="!p-4 text-center">
                <div className="text-2xl">{s.icon}</div>
                <div className="text-2xl font-black text-blue-700">{s.value}</div>
                <div className="text-xs font-bold text-slate-500">{s.label}</div>
              </Card>
            ))}
          </div>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-black text-blue-950">Oxirgi natijalar</h2>
              <Link href="/progress" className="text-sm font-bold text-blue-700 hover:underline">
                Mening natijalarim →
              </Link>
            </div>
            {!progress ? (
              <p className="text-slate-400">Yuklanmoqda…</p>
            ) : progress.recent.length === 0 ? (
              <div className="rounded-2xl bg-blue-50 p-5 text-center">
                <p className="text-3xl">🚀</p>
                <p className="font-bold text-blue-900">Hali birorta test topshirmading.</p>
                <p className="text-sm text-slate-600">Birinchi testni boshlab, {CHARACTER_BY_ID[mascot!].name}ga birinchi mukofotni yutib ber!</p>
              </div>
            ) : (
              <ul className="divide-y divide-blue-50">
                {progress.recent.slice(0, 4).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="font-bold text-slate-700">
                      {SUBJECT_BY_ID[r.subject].emoji} {SUBJECT_BY_ID[r.subject].title} · {r.grade}-sinf
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700">
                      {r.score}/{r.maxScore}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-xl font-black text-blue-950">Yangi yutuqlar</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(progress?.achievements ?? []).map((a) => (
                <div key={a.id} className={`rounded-2xl p-3 ring-1 ${a.unlocked ? "bg-blue-50 ring-blue-200" : "bg-slate-50 ring-slate-100 opacity-60"}`}>
                  <div className="font-extrabold text-blue-900">
                    {a.unlocked ? "🏅" : "🔒"} {a.title}
                  </div>
                  <div className="text-xs text-slate-500">{a.description}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="order-1 lg:order-2">
          <div className="sticky top-20 rounded-4xl bg-linear-to-b from-blue-100 via-white to-white p-3 ring-1 ring-blue-100">
            <p className="px-3 pt-2 text-sm font-extrabold uppercase tracking-wide text-blue-600">Mening qahramonim</p>
            <MascotView id={mascot!} mood={lastEquipped.length ? "wearing_rewards" : "idle"} equipped={lastEquipped} reaction={{ kind: "none", nonce: 0 }} className="h-72 sm:h-96" />
            <p className="text-center text-xl font-black text-blue-900">{CHARACTER_BY_ID[mascot!].name}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 pb-2">
              {(progress?.rewards ?? []).length === 0 ? (
                <span className="text-sm text-slate-500">Mukofotlar shu yerda to‘planadi</span>
              ) : (
                progress!.rewards.map((r) => (
                  <span key={r} className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-700 ring-1 ring-blue-100">
                    {REWARDS[r].emoji} {REWARDS[r].title}
                  </span>
                ))
              )}
            </div>
            <Link href="/profile" className={`${btnClass("ghost")} w-full`}>
              Qahramonni almashtirish
            </Link>
          </div>
        </aside>
      </main>
    </>
  );
}
