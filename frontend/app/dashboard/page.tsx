"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppHeader, Alert, Card, PageLoader, btnClass } from "@/components/ui";
import { MascotView } from "@/components/MascotView";
import { CHARACTER_BY_ID, REWARDS, SUBJECT_BY_ID } from "@/lib/data";
import { api, type Progress } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

export default function Dashboard() {
  const t = useT();
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
  const worn = user.child?.equipped ?? [];
  const child = user.child;
  const xpSpan = child ? child.levelCeilXp - child.levelFloorXp : 1;
  const xpPct = child ? Math.min(100, Math.round(((child.xp - child.levelFloorXp) / xpSpan) * 100)) : 0;
  const subjectStats = progress?.bySubject[subject!];

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_420px]">
        <div className="order-2 space-y-5 lg:order-1">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-black text-blue-950 sm:text-4xl">{t("Salom, {name}! 👋", { name: user.name })}</h1>
            <p className="mt-1 text-lg text-slate-600">{t("Bugun nimalarni o‘rganamiz?")}</p>
          </motion.div>
          {error && <Alert>{error}</Alert>}

          {child && (
            <Card className="!p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-wide text-blue-600">{t("{n}-daraja", { n: child.level })}</p>
                  <p className="text-xl font-black text-blue-950">{t(child.levelTitle)}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm font-black">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{t("⭐ {n} ball", { n: child.balance })}</span>
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-800" title={t("Eng uzun seriya: {n} kun", { n: child.bestStreak })}>
                    {t("🔥 {n} kunlik seriya", { n: child.streak })}
                  </span>
                  {progress?.dailyGoal && (
                    <span className={`rounded-full px-3 py-1 ${progress.dailyGoal.met ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                      {t("🎯 Bugun: {done}/{goal} test", { done: Math.min(progress.dailyGoal.done, progress.dailyGoal.goal), goal: progress.dailyGoal.goal })}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-blue-100" role="progressbar" aria-label={t("Keyingi darajagacha")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={xpPct}>
                  <motion.div className="h-full rounded-full bg-blue-600" initial={{ width: 0 }} animate={{ width: `${xpPct}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {child.xp} / {child.levelCeilXp} XP
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/tasks" className={btnClass("secondary")}>
                  {t("⚡ Kun savoli")}
                </Link>
                <Link href="/shop" className={btnClass("secondary")}>
                  {t("🛍 Do‘kon")}
                </Link>
              </div>
            </Card>
          )}

          <Card className="bg-linear-to-br from-blue-600 to-blue-700 text-white ring-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
              <span className="rounded-full bg-white/20 px-3 py-1">{t("{n}-sinf", { n: grade })}</span>
              <span className="rounded-full bg-white/20 px-3 py-1">
                {subj.emoji} {t(subj.title)}
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-black">{t("Bilimingni sinab ko‘r!")}</h2>
            <p className="mt-1 text-blue-100">{t("5 bosqichli testlar, aralash test va sinov imtihoni — har bir to‘g‘ri javob uchun ball va mukofot")}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/tests" className="inline-flex min-h-12 items-center rounded-2xl bg-white px-6 font-extrabold text-blue-700 shadow-[0_5px_0_#93c5fd] transition hover:bg-blue-50 active:translate-y-[3px] active:shadow-[0_2px_0_#93c5fd]">
                {subjectStats?.attempts ? t("Testlarni tanlash ▶") : t("Testlarni ko‘rish ▶")}
              </Link>
              {!!subjectStats?.mistakesToReview && (
                <Link href="/quiz?mode=mistakes" className="inline-flex min-h-12 items-center rounded-2xl px-5 font-bold text-white ring-2 ring-white/50 hover:bg-white/10">
                  {t("Xatolar ustida ishlash")} ({subjectStats.mistakesToReview})
                </Link>
              )}
              <Link href="/onboarding?step=subject" className="inline-flex min-h-12 items-center rounded-2xl px-5 font-bold text-white ring-2 ring-white/50 hover:bg-white/10">
                {t("Boshqa fan tanlash")}
              </Link>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t("Jami ball"), value: progress?.totalPoints ?? "–", icon: "⭐" },
              { label: t("To‘g‘ri javoblar"), value: progress?.totalCorrect ?? "–", icon: "✅" },
              { label: t("Testlar"), value: progress?.quizzes ?? "–", icon: "📝" },
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
              <h2 className="text-xl font-black text-blue-950">{t("Oxirgi natijalar")}</h2>
              <Link href="/progress" className="text-sm font-bold text-blue-700 hover:underline">
                {t("Mening natijalarim →")}
              </Link>
            </div>
            {!progress ? (
              <p className="text-slate-400">{t("Yuklanmoqda…")}</p>
            ) : progress.recent.length === 0 ? (
              <div className="rounded-2xl bg-blue-50 p-5 text-center">
                <p className="text-3xl">🚀</p>
                <p className="font-bold text-blue-900">{t("Hali birorta test topshirmading.")}</p>
                <p className="text-sm text-slate-600">{t("Birinchi testni boshlab, {name}ga birinchi mukofotni yutib ber!", { name: t(CHARACTER_BY_ID[mascot!].name) })}</p>
              </div>
            ) : (
              <ul className="divide-y divide-blue-50">
                {progress.recent.slice(0, 4).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="font-bold text-slate-700">
                      {SUBJECT_BY_ID[r.subject].emoji} {t(SUBJECT_BY_ID[r.subject].title)} · {t("{n}-sinf", { n: r.grade })}
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
            <h2 className="mb-3 text-xl font-black text-blue-950">{t("Yangi yutuqlar")}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(progress?.achievements ?? []).map((a) => (
                <div key={a.id} className={`rounded-2xl p-3 ring-1 ${a.unlocked ? "bg-blue-50 ring-blue-200" : "bg-slate-50 ring-slate-100 opacity-60"}`}>
                  <div className="font-extrabold text-blue-900">
                    {a.unlocked ? "🏅" : "🔒"} {t(a.title)}
                  </div>
                  <div className="text-xs text-slate-500">{t(a.description)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="order-1 lg:order-2">
          <div className="sticky top-20 rounded-4xl bg-linear-to-b from-blue-100 via-white to-white p-3 ring-1 ring-blue-100">
            <p className="px-3 pt-2 text-sm font-extrabold uppercase tracking-wide text-blue-600">{t("Mening qahramonim")}</p>
            <MascotView id={mascot!} mood={worn.length ? "wearing_rewards" : "idle"} equipped={worn} reaction={{ kind: "none", nonce: 0 }} className="h-72 sm:h-96" />
            <p className="text-center text-xl font-black text-blue-900">{t(CHARACTER_BY_ID[mascot!].name)}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 pb-2">
              {(progress?.rewards ?? []).length === 0 ? (
                <span className="text-sm text-slate-500">{t("Mukofotlar shu yerda to‘planadi")}</span>
              ) : (
                progress!.rewards.map((r) => (
                  <span key={r} className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-700 ring-1 ring-blue-100">
                    {REWARDS[r].emoji} {t(REWARDS[r].title)}
                  </span>
                ))
              )}
            </div>
            <Link href="/profile" className={`${btnClass("ghost")} w-full`}>
              {t("Qahramonni almashtirish")}
            </Link>
          </div>
        </aside>
      </main>
    </>
  );
}
