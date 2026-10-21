"use client";

import { dateLocale, useI18n, useT } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader, Alert, Card, PageLoader, btnClass } from "@/components/ui";
import { REWARDS, SUBJECT_BY_ID, gradeLabel, type Subject } from "@/lib/data";
import { SubjectBadge } from "@/components/SubjectBadge";
import { api, type Progress } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

export default function ProgressPage() {
  const t = useT();
  const { locale } = useI18n();
  const user = useRequireUser();
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) api<Progress>("/api/progress").then(setData).catch((e) => setError(e.message));
  }, [user]);

  if (!user) return <PageLoader />;
  const kids = user.profile.module === "junior";
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6">
        <h1 className="text-3xl font-black text-blue-950">{t("Mening natijalarim")}</h1>
        {error && <Alert>{error}</Alert>}
        {!data && !error && <PageLoader />}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["⭐", t("Jami ball"), data.totalPoints],
                ["📝", t("Testlar"), data.quizzes],
                ["✅", t("To‘g‘ri javoblar"), data.totalCorrect],
                ["🏅", t("Yutuqlar"), `${data.achievements.filter((a) => a.unlocked).length}/${data.achievements.length}`],
              ].map(([i, l, v]) => (
                <Card key={l as string} className="!p-4 text-center">
                  {kids && <div className="text-2xl">{i}</div>}
                  <div className="text-2xl font-black text-blue-700">{v}</div>
                  <div className="text-xs font-bold text-slate-500">{l}</div>
                </Card>
              ))}
            </div>
            {data.grade && <p className="text-sm font-semibold text-slate-500">{t("Statistika va natijalar: {n} bo‘yicha. Ball, daraja va yutuqlar umumiy.", { n: gradeLabel(t, data.grade) })}</p>}

            <Card>
              <h2 className="mb-4 text-xl font-black text-blue-950">{t("Fanlar bo‘yicha")}</h2>
              <div className="space-y-3">
                {(Object.keys(data.bySubject) as Subject[]).map((id) => {
                  const s = SUBJECT_BY_ID[id];
                  const st = data.bySubject[id];
                  return (
                    <div key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[220px_1fr_auto]">
                      <span className="flex items-center gap-2 font-bold text-slate-700">
                        <SubjectBadge subject={s.id} kids={kids} />
                        {t(s.title)}
                      </span>
                      <div className="order-3 col-span-2 h-3 overflow-hidden rounded-full bg-blue-100 sm:order-none sm:col-span-1">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${st.avgAccuracy}%` }} />
                      </div>
                      <span className="text-sm font-bold text-slate-500">
                        {st.attempts ? t("eng yaxshi: {score} · {acc}%", { score: st.bestScore, acc: st.avgAccuracy }) : t("hali yo‘q")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <h2 className="mb-3 text-xl font-black text-blue-950">{t("So‘nggi faollik")}</h2>
                {data.recent.length === 0 ? (
                  <div className="text-center">
                    <p className="text-slate-500">{t("Hali test topshirilmagan.")}</p>
                    <Link href="/quiz" className={`${btnClass()} mt-3`}>
                      {t("Darsni boshlash")}
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-blue-50">
                    {data.recent.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                        <span className="font-bold text-slate-700">
                          {t(SUBJECT_BY_ID[r.subject].title)}, {gradeLabel(t, r.grade)}
                          <span className="block text-xs font-normal text-slate-400">{new Date(r.createdAt).toLocaleString(dateLocale(locale))}</span>
                        </span>
                        <span className="font-black text-blue-700">
                          {t("{n} ball", { n: r.score })} · {r.accuracy}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <h2 className="mb-3 text-xl font-black text-blue-950">{t("Mening yutuqlarim")}</h2>
                <div className="grid grid-cols-2 gap-2">
                  {data.achievements.map((a) => (
                    <div key={a.id} className={`rounded-2xl p-3 ring-1 ${a.unlocked ? "bg-blue-50 ring-blue-200" : "bg-slate-50 opacity-60 ring-slate-100"}`}>
                      <div className="font-extrabold text-blue-900">
                        {kids ? (a.unlocked ? "🏅 " : "🔒 ") : ""}
                        {t(a.title)}
                      </div>
                      <div className="text-xs text-slate-500">{t(a.description)}</div>
                    </div>
                  ))}
                </div>
                {kids && (
                  <>
                    <h3 className="mb-2 mt-4 font-black text-blue-950">{t("Yutilgan buyumlar")}</h3>
                    <div className="flex flex-wrap gap-2">
                      {data.rewards.length === 0 && <span className="text-sm text-slate-500">{t("Hali buyum yutilmagan")}</span>}
                      {data.rewards.map((r) => (
                        <span key={r} className="rounded-full bg-white px-3 py-1 text-sm font-bold ring-1 ring-blue-100">
                          {REWARDS[r].emoji} {REWARDS[r].title}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>
          </>
        )}
      </main>
    </>
  );
}
