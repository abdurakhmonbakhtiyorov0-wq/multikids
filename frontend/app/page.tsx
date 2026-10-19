"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { MascotView } from "@/components/MascotView";
import { AppHeader, btnClass } from "@/components/ui";
import { CHARACTERS, SUBJECTS } from "@/lib/data";
import { nextStepFor, useAuth } from "@/lib/auth";
import type { MascotId } from "@/lib/data";

export default function Home() {
  const t = useT();
  const { user } = useAuth();
  const [hero, setHero] = useState<MascotId>("ajdarcha");
  return (
    <>
      <AppHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 py-10 lg:grid-cols-2">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <span className="inline-block rounded-full bg-blue-100 px-4 py-1.5 text-sm font-extrabold text-blue-700">{t("1–4-sinflar uchun")}</span>
          <h1 className="text-4xl font-black leading-tight text-blue-950 sm:text-5xl">
            {t("Xush kelibsiz!")} <br />
            <span className="text-blue-600">{t("O‘yin orqali o‘rganamiz.")}</span>
          </h1>
          <p className="max-w-lg text-lg text-slate-600">
            {t("O‘z qahramoningni tanla, savollarga javob ber va har bir to‘g‘ri javob uchun kepka, kubok, to‘p kabi 3D mukofotlarni yut!")}
          </p>
          <div className="flex flex-wrap gap-3">
            {user ? (
              <Link href={nextStepFor(user)} className={btnClass()}>
                {t("Davom etish →")}
              </Link>
            ) : (
              <>
                <Link href="/register" className={btnClass()}>
                  {t("Ro‘yxatdan o‘tish")}
                </Link>
                <Link href="/login" className={btnClass("secondary")}>
                  {t("Kirish")}
                </Link>
              </>
            )}
          </div>
          <ul className="flex flex-wrap gap-2 pt-2">
            {SUBJECTS.map((s) => (
              <li key={s.id} className="rounded-2xl bg-white px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-blue-100">
                {s.emoji} {t(s.title)}
              </li>
            ))}
          </ul>
        </motion.section>
        <section className="rounded-4xl bg-linear-to-b from-blue-100 to-white p-3 ring-1 ring-blue-100">
          <MascotView id={hero} mood="idle" equipped={["cap", "clothing"]} reaction={{ kind: "none", nonce: 0 }} className="h-[360px] sm:h-[440px]" />
          <div className="flex flex-wrap justify-center gap-1.5 p-2">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                onClick={() => setHero(c.id)}
                aria-pressed={hero === c.id}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${hero === c.id ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-blue-50"}`}
              >
                {t(c.name)}
              </button>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
