"use client";

import { useT } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppHeader, Alert, Button, PageLoader } from "@/components/ui";
import { MascotAvatar } from "@/components/MascotAvatar";
import { MascotView } from "@/components/MascotView";
import { CHARACTERS, CHARACTER_BY_ID, GRADES, SUBJECTS, type Grade, type MascotId, type Subject } from "@/lib/data";
import { useAuth, useRequireUser } from "@/lib/auth";
import { api, type HeroInfo } from "@/lib/api";

type Step = "character" | "welcome" | "grade" | "subject";

export default function Onboarding() {
  const t = useT();
  const user = useRequireUser({ onboarded: false });
  const { updateProfile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step | null>(null);
  const [mascot, setMascot] = useState<MascotId | null>(null);
  const [heroes, setHeroes] = useState<Map<string, HeroInfo>>(new Map());
  useEffect(() => {
    api<{ heroes: HeroInfo[] }>("/api/heroes")
      .then((r) => setHeroes(new Map(r.heroes.map((h) => [h.id, h]))))
      .catch(() => {});
  }, []);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || step) return;
    const p = user.profile;
    // Profil yuklangandan keyin bir martalik boshlang'ich qiymatlar.
    /* eslint-disable react-hooks/set-state-in-effect */
    setMascot(p.mascot);
    setGrade(p.grade);
    setSubject(p.subject);
    const wanted = new URLSearchParams(window.location.search).get("step") as Step | null;
    setStep(wanted && ["character", "grade", "subject"].includes(wanted) ? wanted : !p.mascot ? "character" : !p.grade ? "grade" : "subject");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user, step]);

  if (!user || !step) return <PageLoader />;

  async function save(patch: Parameters<typeof updateProfile>[0], next: Step | "done") {
    setBusy(true);
    setError("");
    try {
      await updateProfile(patch);
      if (next === "done") router.push("/dashboard");
      else setStep(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Saqlab bo‘lmadi"));
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = { character: 0, welcome: 0, grade: 1, subject: 2 }[step];

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <ol className="mb-6 flex items-center justify-center gap-2" aria-label={t("Qadamlar")}>
          {["Qahramon", "Sinf", "Fan"].map((l, i) => (
            <li key={l} className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-extrabold ${i <= stepIndex ? "bg-blue-600 text-white" : "bg-white text-slate-400 ring-1 ring-blue-100"}`} aria-current={i === stepIndex ? "step" : undefined}>
              {i + 1}. {t(l)}
            </li>
          ))}
        </ol>
        {error && (
          <div className="mx-auto mb-4 max-w-xl">
            <Alert>{error}</Alert>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
            {step === "character" && (
              <section>
                <h1 className="text-center text-3xl font-black text-blue-950">{t("Keling, do‘stingizni tanlaymiz!")}</h1>
                <p className="mb-6 text-center text-slate-500">{t("U senga darslarda hamroh bo‘ladi")}</p>
                <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5" role="radiogroup" aria-label={t("Qahramonlar")}>
                    {CHARACTERS.map((c, i) => (
                      <motion.button
                        key={c.id}
                        role="radio"
                        aria-checked={mascot === c.id}
                        onClick={() => setMascot(c.id)}
                        disabled={heroes.size > 0 && !heroes.get(c.id)?.unlocked}
                        title={heroes.get(c.id)?.requirement ?? undefined}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                        whileHover={{ y: -6 }}
                        className={`relative flex flex-col items-center rounded-3xl bg-white p-3 text-center ring-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${mascot === c.id ? "ring-blue-500 shadow-[0_8px_0_#bfdbfe]" : "ring-blue-100 hover:ring-blue-300"}`}
                      >
                        {mascot === c.id && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-xs text-white">✓</span>}
                        <MascotAvatar character={c} size={84} />
                        <span className="mt-1 font-extrabold text-blue-950">{t(c.name)}</span>
                        <span className="text-xs text-slate-500">{t(c.tagline)}</span>
                        {heroes.size > 0 && !heroes.get(c.id)?.unlocked && <span className="mt-1 text-xs font-bold text-amber-700">🔒 {t(heroes.get(c.id)?.requirement ?? "")}</span>}
                      </motion.button>
                    ))}
                  </div>
                  <div className="flex flex-col rounded-3xl bg-linear-to-b from-blue-100 to-white p-3 ring-1 ring-blue-100">
                    {mascot ? (
                      <>
                        <MascotView id={mascot} mood="idle" equipped={[]} reaction={{ kind: "none", nonce: 0 }} className="h-72 lg:h-80" />
                        <p className="py-2 text-center text-lg font-black text-blue-900">{t(CHARACTER_BY_ID[mascot].name)}</p>
                        <Button loading={busy} onClick={() => save({ mascot }, "welcome")}>
                          {t("Shu qahramonni tanlayman")}
                        </Button>
                      </>
                    ) : (
                      <div className="grid h-72 place-items-center p-6 text-center font-bold text-slate-500 lg:h-96">{t("Qahramonni bosing — u shu yerda 3D ko‘rinishda paydo bo‘ladi 👈")}</div>
                    )}
                  </div>
                </div>
              </section>
            )}
            {step === "welcome" && mascot && (
              <section className="mx-auto max-w-lg text-center">
                <MascotView id={mascot} mood="celebrating" equipped={[]} reaction={{ kind: "celebrate", nonce: 1 }} className="h-80" />
                <h1 className="text-3xl font-black text-blue-950">{t("Salom, {name}! 🎉", { name: user.name })}</h1>
                <p className="mb-6 mt-2 text-lg text-slate-600">{t("Men {name}man. Birga o‘rganamiz!", { name: t(CHARACTER_BY_ID[mascot].name) })}</p>
                <Button onClick={() => setStep(user.profile.grade ? "subject" : "grade")}>{t("Davom etish →")}</Button>
              </section>
            )}
            {step === "grade" && (
              <section>
                <h1 className="mb-6 text-center text-3xl font-black text-blue-950">{t("Qaysi sinfda o‘qiysiz?")}</h1>
                <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4" role="radiogroup">
                  {GRADES.map((g) => (
                    <motion.button
                      key={g.id}
                      role="radio"
                      aria-checked={grade === g.id}
                      whileHover={{ y: -6, rotate: -1 }}
                      onClick={() => setGrade(g.id)}
                      className={`flex flex-col items-center gap-2 rounded-3xl bg-white p-6 ring-2 transition ${grade === g.id ? "ring-blue-500 shadow-[0_8px_0_#bfdbfe]" : "ring-blue-100 hover:ring-blue-300"}`}
                    >
                      <span className="text-5xl">{g.emoji}</span>
                      <span className="text-2xl font-black text-blue-700">{t(g.title)}</span>
                      <span className="text-sm text-slate-500">{t(g.note)}</span>
                    </motion.button>
                  ))}
                </div>
                <div className="mt-8 flex justify-center gap-3">
                  <Button variant="secondary" onClick={() => setStep("character")}>
                    {t("← Orqaga")}
                  </Button>
                  <Button disabled={!grade} loading={busy} onClick={() => grade && save({ grade }, "subject")}>
                    {t("Tasdiqlash")}
                  </Button>
                </div>
              </section>
            )}
            {step === "subject" && (
              <section>
                <h1 className="mb-6 text-center text-3xl font-black text-blue-950">{t("Qaysi fanni o‘rganmoqchisiz?")}</h1>
                <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3" role="radiogroup">
                  {SUBJECTS.map((s) => (
                    <motion.button
                      key={s.id}
                      role="radio"
                      aria-checked={subject === s.id}
                      whileHover={{ y: -5 }}
                      onClick={() => setSubject(s.id)}
                      className={`flex items-center gap-4 rounded-3xl bg-white p-5 text-left ring-2 transition ${subject === s.id ? "ring-blue-500 shadow-[0_8px_0_#bfdbfe]" : "ring-blue-100 hover:ring-blue-300"}`}
                    >
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl" style={{ background: s.tint }}>
                        {s.emoji}
                      </span>
                      <span>
                        <span className="block text-lg font-black text-blue-950">{t(s.title)}</span>
                        <span className="text-sm text-slate-500">{t(s.description)}</span>
                      </span>
                    </motion.button>
                  ))}
                </div>
                <div className="mt-8 flex justify-center gap-3">
                  <Button variant="secondary" onClick={() => setStep("grade")}>
                    {t("← Sinf")}
                  </Button>
                  <Button disabled={!subject} loading={busy} onClick={() => subject && save({ subject }, "done")}>
                    {t("Darsni boshlash")}
                  </Button>
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}
