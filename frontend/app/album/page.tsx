"use client";

import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppHeader, Alert, Card, PageLoader } from "@/components/ui";
import { MascotAvatar } from "@/components/MascotAvatar";
import { CHARACTERS } from "@/lib/data";
import { api, type HeroInfo, type Progress } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

export default function AlbumPage() {
  const t = useT();
  const user = useRequireUser();
  const [heroes, setHeroes] = useState<HeroInfo[] | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api<{ heroes: HeroInfo[] }>("/api/heroes")
      .then((r) => setHeroes(r.heroes))
      .catch((e) => setError(e.message));
    api<Progress>("/api/progress")
      .then(setProgress)
      .catch((e) => setError(e.message));
  }, [user]);

  if (!user) return <PageLoader />;
  const byId = new Map((heroes ?? []).map((h) => [h.id, h]));
  const unlockedCount = (heroes ?? []).filter((h) => h.unlocked).length;
  const badges = progress?.achievements ?? [];

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-6">
        <div>
          <h1 className="text-3xl font-black text-blue-950">{t("📚 Albom")}</h1>
          <p className="text-slate-600">{t("Qahramonlar va yutuqlar to‘plami. Ba’zi qahramonlar faqat yutuqlar evaziga ochiladi.")}</p>
        </div>
        {error && <Alert>{error}</Alert>}
        {!heroes && !error && <PageLoader />}

        {heroes && (
          <section aria-labelledby="heroes-title">
            <h2 id="heroes-title" className="mb-3 text-xl font-black text-blue-950">
              {t("Qahramonlar")} · {unlockedCount}/{heroes.length}
            </h2>
            <ul className="grid grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-5">
              {CHARACTERS.map((c, i) => {
                const h = byId.get(c.id);
                const open = h?.unlocked ?? false;
                return (
                  <motion.li key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }} className="list-none">
                    <Card className={`flex h-full flex-col items-center text-center !p-3 ${open ? "" : "bg-slate-50"}`}>
                      <div className={open ? "" : "opacity-40 grayscale"} aria-hidden>
                        <MascotAvatar character={c} size={84} />
                      </div>
                      <span className="mt-1 font-extrabold text-blue-950">{open ? t(c.name) : "???"}</span>
                      {user.profile.mascot === c.id && <span className="mt-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">{t("Tanlangan")}</span>}
                      {!open && h?.requirement && <span className="mt-1 text-xs font-bold text-amber-700">🔒 {t(h.requirement)}</span>}
                    </Card>
                  </motion.li>
                );
              })}
            </ul>
          </section>
        )}

        {progress && (
          <section aria-labelledby="badges-title">
            <h2 id="badges-title" className="mb-3 text-xl font-black text-blue-950">
              {t("Yutuqlar")} · {badges.filter((b) => b.unlocked).length}/{badges.length}
            </h2>
            <ul className="grid gap-3 p-0 sm:grid-cols-2 md:grid-cols-3">
              {badges.map((b) => (
                <li key={b.id} className={`list-none rounded-2xl p-4 ring-1 ${b.unlocked ? "bg-white ring-blue-200" : "bg-slate-50 opacity-60 ring-slate-100"}`}>
                  <div className="text-3xl" aria-hidden>
                    {b.unlocked ? "🏅" : "🔒"}
                  </div>
                  <div className="font-extrabold text-blue-950">{t(b.title)}</div>
                  <div className="text-sm text-slate-600">{t(b.description)}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
