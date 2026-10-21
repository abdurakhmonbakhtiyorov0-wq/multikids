"use client";

import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { AppHeader, Alert, Button, Card, Field, PageLoader } from "@/components/ui";
import { MascotAvatar } from "@/components/MascotAvatar";
import { CHARACTERS, GRADES, MODULES, gradeLabel, type Grade, type MascotId, type Subject } from "@/lib/data";
import { useCurriculum } from "@/lib/curriculum";
import { useAuth, useRequireUser } from "@/lib/auth";
import { api, ApiError, childStore, parentStore, type HeroInfo } from "@/lib/api";
import Link from "next/link";
import { InstallApp } from "@/components/InstallApp";
import { readAppearance, saveAppearance, type FontSize, type Theme } from "@/lib/appearance";

export default function ProfilePage() {
  const user = useRequireUser();
  if (!user) return <PageLoader />;
  return <ProfileForm key={user.id} />;
}

/** Boshlang‘ich sinfdan (1–4) o‘tish uchun ota-ona PIN-kodi kerak; 5-sinfdan boshlab bu talab yo‘q. */
function GradeLock({ onUnlocked }: { onUnlocked: () => void }) {
  const t = useT();
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ hasPin: boolean }>("/api/parent/status")
      .then((r) => setHasPin(r.hasPin))
      .catch(() => setHasPin(null));
  }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ parentToken: string; expiresIn: number }>("/api/parent/verify", { method: "POST", body: { pin } });
      parentStore.set(r.parentToken, r.expiresIn);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Xatolik yuz berdi"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <p className="font-bold">{t("🔒 Boshlang‘ich sinfdan o‘tish uchun ota-ona PIN-kodi kerak.")}</p>
      {hasPin === false ? (
        <>
          <p>{t("Avval ota-ona bo‘limida PIN-kod o‘rnating.")}</p>
          <Link href="/parent" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 font-bold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50">
            {t("Ota-ona bo‘limiga o‘tish")}
          </Link>
        </>
      ) : (
        <form onSubmit={unlock} className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block font-bold">{t("PIN-kod")}</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="h-11 w-32 rounded-xl border-2 border-amber-200 bg-white px-3 text-slate-900"
            />
          </label>
          <Button type="submit" loading={busy} disabled={pin.length < 4}>
            {t("🔓 Ota-ona sifatida ochish")}
          </Button>
        </form>
      )}
      {error && <p className="font-semibold text-rose-700">{error}</p>}
    </div>
  );
}

/**
 * Sinfni almashtirish oynasi. Har bir sinf — alohida profil: hozirgi sinfdagi yutuqlar shu sinfda qoladi,
 * yangi sinf noldan boshlanadi, avvalgisiga qaytsangiz yutuqlar qaytadi.
 */
function GradeChangeDialog({ current, onClose }: { current: Grade; onClose: () => void }) {
  const t = useT();
  const needPin = current <= 4; // boshlang‘ich sinfdan o‘tish — ota-ona PIN-kodi bilan
  const [unlocked, setUnlocked] = useState(() => parentStore.get() !== null);
  const [target, setTarget] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ childId: string }>("/api/me/grade", { method: "POST", body: { grade: target } });
      childStore.set(r.childId);
      // Sahifani to‘liq yangilaymiz: oldingi sinf ma’lumoti xotirada qolib, aralashib ketmasin.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/dashboard";
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setUnlocked(false);
      setError(e instanceof Error ? e.message : t("Xatolik yuz berdi"));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/60 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="grade-dialog-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-5 shadow-xl sm:p-6">
        <h2 id="grade-dialog-title" className="text-2xl font-black text-blue-950">
          {t("Sinfni o‘zgartirish")}
        </h2>
        <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {t("Sinf almashtirilganda hozirgi sinfdagi barcha yutuqlar shu sinfda saqlanadi. Boshqa sinfga o‘tsangiz, qolgan hammasi (ball, daraja, yutuqlar, natijalar) yangi sinfda noldan boshlanadi. Avvalgi sinfga qaytsangiz, o‘sha yutuqlar qaytadi.")}
        </p>
        {MODULES.map((m) => (
          <fieldset key={m.id} className="space-y-1.5">
            <legend className="text-sm font-bold text-slate-600">
              {t(m.title)} ({t(m.ages)})
            </legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t(m.title)}>
              {GRADES.filter((g) => m.grades.includes(g.id)).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={target === g.id}
                  disabled={g.id === current}
                  onClick={() => setTarget(g.id)}
                  className={`rounded-2xl px-4 py-2 font-bold ring-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${target === g.id ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-slate-700 ring-blue-100 hover:ring-blue-300"}`}
                >
                  {gradeLabel(t, g.id)}
                  {g.id === current && ` · ${t("hozirgi")}`}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        {needPin && !unlocked && <GradeLock onUnlocked={() => setUnlocked(true)} />}
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("Bekor qilish")}
          </Button>
          <Button onClick={confirm} loading={busy} disabled={!target || (needPin && !unlocked)}>
            {t("Sinfga o‘tish")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProfileForm() {
  const t = useT();
  const [changingGrade, setChangingGrade] = useState(false);
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user!.name);
  const [mascot, setMascot] = useState<MascotId | null>(user!.profile.mascot);
  const grade = user!.profile.grade!;
  const [subject, setSubject] = useState<Subject>(user!.profile.subject!);
  const junior = user!.profile.module === "junior";
  const curriculum = useCurriculum();
  const subjectOptions = curriculum.subjects(grade);
  const [heroes, setHeroes] = useState<Map<string, HeroInfo>>(new Map());
  useEffect(() => {
    api<{ heroes: HeroInfo[] }>("/api/heroes")
      .then((r) => setHeroes(new Map(r.heroes.map((h) => [h.id, h]))))
      .catch(() => {});
  }, []);
  const [look, setLook] = useState(() => (typeof window === "undefined" ? { theme: "system" as Theme, size: "normal" as FontSize } : readAppearance()));
  const changeLook = (patch: Partial<{ theme: Theme; size: FontSize }>) => {
    const next = { ...look, ...patch };
    setLook(next);
    saveAppearance(next);
  };
  const [sound, setSound] = useState(user!.child?.soundEnabled ?? true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  async function save() {
    if (name.trim().length < 2) return setMsg({ tone: "error", text: t("Ism kamida 2 harfdan iborat bo‘lsin") });
    setBusy(true);
    setMsg(null);
    try {
      await updateProfile({ name: name.trim(), ...(junior && mascot ? { mascot } : {}), subject, soundEnabled: sound });
      setMsg({ tone: "info", text: t("✓ O‘zgarishlar saqlandi!") });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : t("Saqlab bo‘lmadi") });
    } finally {
      setBusy(false);
    }
  }

  const chip = (on: boolean) => `rounded-2xl px-4 py-2 font-bold ring-2 transition ${on ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-slate-700 ring-blue-100 hover:ring-blue-300"}`;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-6">
        <h1 className="text-3xl font-black text-blue-950">{t("Profil sozlamalari")}</h1>
        <Card className="space-y-6">
          <Field label={t("Ism")} name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
          <p className="-mt-3 text-sm text-slate-500">{t("Email:")} {user!.email}</p>
          {junior && (
          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">{t("Qahramon")}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {CHARACTERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setMascot(c.id)}
                  disabled={heroes.size > 0 && !heroes.get(c.id)?.unlocked && user!.profile.mascot !== c.id}
                  aria-pressed={mascot === c.id}
                  title={heroes.get(c.id)?.requirement ? t(heroes.get(c.id)!.requirement!) : undefined}
                  className={`flex flex-col items-center rounded-2xl p-2 ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${mascot === c.id ? "bg-blue-50 ring-blue-500" : "ring-blue-100 hover:ring-blue-300"}`}
                >
                  <MascotAvatar character={c} size={60} />
                  <span className="text-xs font-bold">{t(c.name)}</span>
                  {heroes.size > 0 && !heroes.get(c.id)?.unlocked && user!.profile.mascot !== c.id && <span className="text-[10px] font-bold text-amber-700">{t("🔒 yopiq")}</span>}
                </button>
              ))}
            </div>
          </div>
          )}
          <InstallApp />
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-bold text-slate-700">{t("Ko‘rinish (shu qurilmada)")}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Mavzu")}>
              {([["light", t("☀️ Yorug‘")], ["dark", t("🌙 Qorong‘i")], ["system", t("🖥 Tizim")]] as const).map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={look.theme === v} onClick={() => changeLook({ theme: v })} className={`rounded-2xl px-4 py-2 font-bold ring-2 ${look.theme === v ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-slate-700 ring-blue-100 hover:ring-blue-300"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Shrift o‘lchami")}>
              {([["normal", t("Aa Oddiy")], ["large", t("Aa Katta")], ["xlarge", t("Aa Juda katta")]] as const).map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={look.size === v} onClick={() => changeLook({ size: v })} className={`rounded-2xl px-4 py-2 font-bold ring-2 ${look.size === v ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-slate-700 ring-blue-100 hover:ring-blue-300"}`}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-bold text-slate-700">{t("Ovoz")}</legend>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-blue-50/60 px-4 py-2 font-bold text-slate-700">
              <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={sound} onChange={(e) => setSound(e.target.checked)} />
              {t("🔊 O‘yin ovozlari")}
            </label>
          </fieldset>
          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">{t("Sinf")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-2xl bg-blue-50 px-4 py-2 font-black text-blue-800 ring-2 ring-blue-100">{gradeLabel(t, grade)}</span>
              <Button variant="secondary" onClick={() => setChangingGrade(true)}>
                {t("Sinfni o‘zgartirish")}
              </Button>
            </div>
            <p className="mt-2 text-sm text-slate-500">{t("Har bir sinfning yutuqlari alohida saqlanadi.")}</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">{t("Asosiy fan")}</p>
            <div className="flex flex-wrap gap-2">
              {subjectOptions.map(({ id, ready, meta }) => (
                <button key={id} onClick={() => setSubject(id)} disabled={!ready} aria-pressed={subject === id} className={`${chip(subject === id)} disabled:cursor-not-allowed disabled:opacity-50`} title={ready ? undefined : t("Tez orada")}>
                  {junior ? `${meta.emoji} ` : ""}
                  {t(meta.title)}
                </button>
              ))}
            </div>
          </div>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Button onClick={save} loading={busy}>
            {t("Saqlash")}
          </Button>
        </Card>
        {changingGrade && <GradeChangeDialog current={grade} onClose={() => setChangingGrade(false)} />}
      </main>
    </>
  );
}
