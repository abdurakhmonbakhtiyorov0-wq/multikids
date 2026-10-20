"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { motion } from "framer-motion";
import { AppHeader, btnClass } from "@/components/ui";
import { MascotAvatar } from "@/components/MascotAvatar";
import { CHARACTER_BY_ID, MODULES, SUBJECTS, type ModuleId, type Subject } from "@/lib/data";
import { nextStepFor, useAuth } from "@/lib/auth";
import { useCurriculum } from "@/lib/curriculum";
import { moduleStore } from "@/lib/module";
import { useModule } from "@/lib/module-context";

// Har bir modul kartasining ko‘rinishi bosh sahifada o‘z rangida (tanlangan mavzudan mustaqil).
const LOOK: Record<ModuleId, { from: string; to: string; ink: string; glyph: React.ReactNode }> = {
  junior: {
    from: "#bfdbfe",
    to: "#fde68a",
    ink: "#1e3a8a",
    glyph: <MascotAvatar character={CHARACTER_BY_ID.pandacha} size={84} />,
  },
  middle: { from: "#cdd5e8", to: "#a8b5d3", ink: "#1a2440", glyph: <span className="text-5xl font-black tracking-tight">5–8</span> },
  senior: {
    from: "#8f78ff",
    to: "#2d2170",
    ink: "#ffffff",
    glyph: (
      <svg width="92" height="92" viewBox="0 0 100 100" aria-hidden>
        <ellipse cx="50" cy="50" rx="44" ry="16" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2" />
        <ellipse cx="50" cy="50" rx="44" ry="16" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2" transform="rotate(60 50 50)" />
        <ellipse cx="50" cy="50" rx="44" ry="16" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2" transform="rotate(120 50 50)" />
        <circle cx="50" cy="50" r="8" fill="#fff" />
        <circle cx="94" cy="50" r="4" fill="#9be7ff" />
        <circle cx="28" cy="12" r="4" fill="#ffd9a0" />
        <circle cx="28" cy="88" r="4" fill="#caffd4" />
      </svg>
    ),
  },
  special: { from: "#0f766e", to: "#052624", ink: "#ffffff", glyph: <span className="text-5xl font-black tracking-tight">SAT</span> },
};

function ModuleCard({ id, subjects, index }: { id: ModuleId; subjects: Subject[]; index: number }) {
  const t = useT();
  const { setModule } = useModule();
  const m = MODULES.find((x) => x.id === id)!;
  const look = LOOK[id];
  const choose = () => {
    moduleStore.set(id);
    setModule(id);
  };
  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: { delay: 0.08 * index } }}
      whileHover={{ y: -4 }}
      className="list-none overflow-hidden rounded-3xl bg-white shadow-[0_10px_30px_-14px_rgba(15,23,42,0.35)] ring-1 ring-blue-100"
    >
      <div className="flex h-36 items-center justify-between gap-2 px-5" style={{ background: `linear-gradient(135deg, ${look.from}, ${look.to})`, color: look.ink }}>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide opacity-80">{t(m.ages)}</p>
          <h2 className="text-2xl font-black">{t(m.title)}</h2>
        </div>
        <div aria-hidden className="shrink-0">
          {look.glyph}
        </div>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <p className="font-extrabold text-blue-950">{t(m.tagline)}</p>
        <p className="text-sm text-slate-600">{t(m.description)}</p>
        <ul className="flex flex-wrap gap-1.5 p-0">
          {subjects.slice(0, 8).map((s) => {
            const meta = SUBJECTS.find((x) => x.id === s)!;
            return (
              <li key={s} className="list-none rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">
                {t(meta.title)}
              </li>
            );
          })}
        </ul>
        <Link href={`/register?module=${id}`} onClick={choose} className={`${btnClass()} mt-1 w-full whitespace-nowrap px-3! text-sm!`}>
          {t("Shu modulni tanlash →")}
        </Link>
      </div>
    </motion.li>
  );
}

export default function Home() {
  const t = useT();
  const { user } = useAuth();
  const { data } = useCurriculum();

  // Modulning fanlari (server o‘quv dasturidan, takrorlarsiz).
  const subjectsOf = (id: ModuleId): Subject[] => {
    const grades = data?.modules.find((m) => m.id === id)?.grades ?? [];
    return [...new Set(grades.flatMap((g) => g.subjects.map((s) => s.id)))];
  };

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-blue-100 px-4 py-1.5 text-sm font-extrabold text-blue-700">{t("1–11-sinf va SAT tayyorgarlik")}</span>
          <h1 className="mt-4 text-4xl font-black leading-tight text-blue-950 sm:text-5xl">
            {t("Xush kelibsiz!")} <br />
            <span className="text-blue-600">{t("O‘zingizga mos modulni tanlang")}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">{t("Testlar, natijalar va o‘sish — yoshingiz va maqsadingizga mos muhitda.")}</p>
          {user ? (
            <div className="mt-6">
              <Link href={nextStepFor(user)} className={btnClass()}>
                {t("Davom etish →")}
              </Link>
            </div>
          ) : (
            <p className="mt-4 text-sm font-semibold text-slate-600">
              {t("Hisobingiz bormi?")}{" "}
              <Link href="/login" className="text-blue-700 underline">
                {t("Kirish")}
              </Link>
            </p>
          )}
        </motion.section>

        {!user && (
          <ul className="mt-10 grid gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4" aria-label={t("Modullar")}>
            {MODULES.map((m, i) => (
              <ModuleCard key={m.id} id={m.id} subjects={subjectsOf(m.id)} index={i} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
