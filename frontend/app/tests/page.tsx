"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppHeader, Alert, Card, PageLoader, btnClass } from "@/components/ui";
import { SUBJECT_BY_ID } from "@/lib/data";
import { api, type Progress, type TestInfo } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

const LEVEL_COLORS = ["bg-emerald-100 text-emerald-800", "bg-lime-100 text-lime-800", "bg-amber-100 text-amber-800", "bg-orange-100 text-orange-800", "bg-red-100 text-red-800"];

function Stat({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-blue-100">{children}</span>;
}

function TestCard({ t }: { t: TestInfo }) {
  const isLevel = t.kind === "level";
  const href = `/quiz?test=${t.id}`;
  const cta = t.inProgress ? "Davom etish ▶" : t.attempts ? "Qayta topshirish ▶" : "Boshlash ▶";
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="list-none">
      <Card className={`flex flex-col gap-3 sm:flex-row sm:items-center ${t.unlocked ? "" : "opacity-70"}`}>
        <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-black ${isLevel ? LEVEL_COLORS[t.order - 1] : t.kind === "exam" ? "bg-violet-100 text-violet-800" : "bg-blue-100 text-blue-800"}`} aria-hidden>
          {t.unlocked ? (isLevel ? t.order : t.kind === "exam" ? "🎓" : "🎲") : "🔒"}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-blue-950">{t.title}</h3>
          <p className="text-sm text-slate-600">{t.note}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Stat>📝 {t.total} ta savol</Stat>
            <Stat>⭐ +{t.pointsPerCorrect} ball / to‘g‘ri</Stat>
            {t.timeLimitSec && <Stat>⏱ {Math.round(t.timeLimitSec / 60)} daqiqa</Stat>}
            {t.bestAccuracy !== null && <Stat>🏅 Eng yaxshi: {t.bestAccuracy}%</Stat>}
            {t.bestMark !== null && <Stat>Baho: {t.bestMark}</Stat>}
            {t.attempts > 0 && <Stat>🔁 {t.attempts} marta</Stat>}
            {t.inProgress && <Stat>⏳ {t.inProgress.answered}/{t.inProgress.total} javob berilgan</Stat>}
          </div>
          {!t.unlocked && t.lockedReason && <p className="mt-2 text-sm font-bold text-amber-700">🔒 {t.lockedReason}</p>}
        </div>
        {t.unlocked && t.available ? (
          <Link href={href} className={`${btnClass(t.inProgress ? "primary" : "secondary")} w-full shrink-0 sm:w-auto`}>
            {cta}
          </Link>
        ) : (
          <span className={`${btnClass("ghost")} w-full shrink-0 cursor-not-allowed opacity-60 sm:w-auto`} aria-disabled>
            {t.available ? "Yopiq" : "Tez orada"}
          </span>
        )}
      </Card>
    </motion.li>
  );
}

export default function TestsPage() {
  const user = useRequireUser();
  const [tests, setTests] = useState<TestInfo[] | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const { grade, subject } = user.profile;
    api<{ tests: TestInfo[] }>(`/api/tests?grade=${grade}&subject=${subject}`)
      .then((r) => setTests(r.tests))
      .catch((e) => setError(e.message));
    api<Progress>("/api/progress")
      .then((p) => setMistakes(p.bySubject[subject!]?.mistakesToReview ?? 0))
      .catch(() => {});
  }, [user]);

  if (!user) return <PageLoader />;
  const subj = SUBJECT_BY_ID[user.profile.subject!];
  const levels = tests?.filter((t) => t.kind === "level") ?? [];
  const others = tests?.filter((t) => t.kind !== "level") ?? [];

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <div>
          <Link href="/dashboard" className="text-sm font-bold text-blue-700 hover:underline">
            ← Bosh sahifa
          </Link>
          <h1 className="mt-1 text-3xl font-black text-blue-950">
            {subj.emoji} {subj.title} · {user.profile.grade}-sinf
          </h1>
          <p className="text-slate-600">Bosqichma-bosqich o‘tib boring: har bir keyingi bosqich oldingisini kamida 60% bilan tugatgandan keyin ochiladi.</p>
        </div>

        {error && <Alert>{error}</Alert>}
        {!tests && !error && <PageLoader />}

        {tests && (
          <>
            <section aria-labelledby="levels-title">
              <h2 id="levels-title" className="mb-3 text-xl font-black text-blue-950">
                5 bosqichli testlar
              </h2>
              <ul className="space-y-3 p-0">{levels.map((t) => <TestCard key={t.id} t={t} />)}</ul>
            </section>

            <section aria-labelledby="other-title">
              <h2 id="other-title" className="mb-3 text-xl font-black text-blue-950">
                Boshqa testlar
              </h2>
              <ul className="space-y-3 p-0">
                {others.map((t) => <TestCard key={t.id} t={t} />)}
                {mistakes > 0 && (
                  <li className="list-none">
                    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-rose-100 text-2xl" aria-hidden>
                        🛠
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-black text-blue-950">Xatolar ustida ishlash</h3>
                        <p className="text-sm text-slate-600">Oldin adashgan {mistakes} ta savolni qayta yeching.</p>
                      </div>
                      <Link href="/quiz?mode=mistakes" className={`${btnClass("secondary")} w-full shrink-0 sm:w-auto`}>
                        Boshlash ▶
                      </Link>
                    </Card>
                  </li>
                )}
              </ul>
            </section>
          </>
        )}
      </main>
    </>
  );
}
