"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppHeader, Alert, Card, PageLoader, btnClass } from "@/components/ui";
import { SUBJECT_BY_ID, gradeLabel } from "@/lib/data";
import { SubjectBadge } from "@/components/SubjectBadge";
import { api, type Progress, type TestInfo } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

const LEVEL_COLORS = ["bg-emerald-100 text-emerald-800", "bg-lime-100 text-lime-800", "bg-amber-100 text-amber-800", "bg-orange-100 text-orange-800", "bg-red-100 text-red-800"];

function Stat({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-blue-100">{children}</span>;
}

function TestCard({ test, kids }: { test: TestInfo; kids: boolean }) {
  const t = useT();
  const isLevel = test.kind === "level";
  const href = `/quiz?test=${test.id}`;
  const cta = test.inProgress ? t("Davom etish ▶") : test.attempts ? t("Qayta topshirish ▶") : t("Boshlash ▶");
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="list-none">
      <Card className={`flex flex-col gap-3 sm:flex-row sm:items-center ${test.unlocked ? "" : "opacity-70"}`}>
        <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-black ${isLevel ? LEVEL_COLORS[test.order - 1] : test.kind === "exam" ? "bg-violet-100 text-violet-800" : "bg-blue-100 text-blue-800"}`} aria-hidden>
          {/* Jiddiy modullarda emoji o‘rniga raqam/harf; yopiq test xira ko‘rinadi */}
          {kids ? (test.unlocked ? (isLevel ? test.order : test.kind === "exam" ? "🎓" : "🎲") : "🔒") : isLevel ? test.order : test.kind === "exam" ? "E" : "M"}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-blue-950">{t(test.title)}</h3>
          <p className="text-sm text-slate-600">{t(test.note)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Stat>{t("📝 {n} ta savol", { n: test.total })}</Stat>
            <Stat>{t("⭐ +{n} ball / to‘g‘ri", { n: test.pointsPerCorrect })}</Stat>
            {test.timeLimitSec && <Stat>{t("⏱ {n} daqiqa", { n: Math.round(test.timeLimitSec / 60) })}</Stat>}
            {test.bestAccuracy !== null && <Stat>{t("🏅 Eng yaxshi: {n}%", { n: test.bestAccuracy })}</Stat>}
            {test.bestMark !== null && <Stat>{t("Baho: {n}", { n: test.bestMark })}</Stat>}
            {test.attempts > 0 && <Stat>{t("🔁 {n} marta", { n: test.attempts })}</Stat>}
            {test.inProgress && <Stat>{t("⏳ {a}/{n} javob berilgan", { a: test.inProgress.answered, n: test.inProgress.total })}</Stat>}
          </div>
          {!test.unlocked && test.lockedReason && <p className="mt-2 text-sm font-bold text-amber-700">{kids ? "🔒 " : ""}{t(test.lockedReason)}</p>}
        </div>
        {test.unlocked && test.available ? (
          <Link href={href} className={`${btnClass(test.inProgress ? "primary" : "secondary")} w-full shrink-0 sm:w-auto`}>
            {cta}
          </Link>
        ) : (
          <span className={`${btnClass("ghost")} w-full shrink-0 cursor-not-allowed opacity-60 sm:w-auto`} aria-disabled>
            {test.available ? t("Yopiq") : t("Tez orada")}
          </span>
        )}
      </Card>
    </motion.li>
  );
}

export default function TestsPage() {
  const t = useT();
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
  const kids = user.profile.module === "junior";
  const levels = tests?.filter((x) => x.kind === "level") ?? [];
  const others = tests?.filter((x) => x.kind !== "level") ?? [];

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <div>
          <Link href="/dashboard" className="text-sm font-bold text-blue-700 hover:underline">
            {t("← Bosh sahifa")}
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-3xl font-black text-blue-950">
            <SubjectBadge subject={subj.id} kids={user.profile.module === "junior"} />
            {t(subj.title)} · {gradeLabel(t, user.profile.grade)}
          </h1>
          <p className="text-slate-600">{t("Bosqichma-bosqich o‘tib boring: har bir keyingi bosqich oldingisini kamida 60% bilan tugatgandan keyin ochiladi.")}</p>
        </div>

        {error && <Alert>{error}</Alert>}
        {!tests && !error && <PageLoader />}

        {tests && (
          <>
            <section aria-labelledby="levels-title">
              <h2 id="levels-title" className="mb-3 text-xl font-black text-blue-950">
                {t("5 bosqichli testlar")}
              </h2>
              <ul className="space-y-3 p-0">
                {levels.map((x) => (
                  <TestCard key={x.id} test={x} kids={kids} />
                ))}
              </ul>
            </section>

            <section aria-labelledby="other-title">
              <h2 id="other-title" className="mb-3 text-xl font-black text-blue-950">
                {t("Boshqa testlar")}
              </h2>
              <ul className="space-y-3 p-0">
                {others.map((x) => (
                  <TestCard key={x.id} test={x} kids={kids} />
                ))}
                {mistakes > 0 && (
                  <li className="list-none">
                    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-rose-100 text-2xl" aria-hidden>
                        {kids ? "🛠" : "!"}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-black text-blue-950">{t("Xatolar ustida ishlash")}</h3>
                        <p className="text-sm text-slate-600">{t("Oldin adashgan {n} ta savolni qayta yeching.", { n: mistakes })}</p>
                      </div>
                      <Link href="/quiz?mode=mistakes" className={`${btnClass("secondary")} w-full shrink-0 sm:w-auto`}>
                        {t("Boshlash ▶")}
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
