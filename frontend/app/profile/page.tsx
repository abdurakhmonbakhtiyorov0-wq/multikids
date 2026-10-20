"use client";

import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { AppHeader, Alert, Button, Card, Field, PageLoader } from "@/components/ui";
import { MascotAvatar } from "@/components/MascotAvatar";
import { CHARACTERS, GRADES, type Grade, type MascotId, type Subject } from "@/lib/data";
import { useCurriculum } from "@/lib/curriculum";
import { useAuth, useRequireUser } from "@/lib/auth";
import { api, ApiError, parentStore, type HeroInfo } from "@/lib/api";
import Link from "next/link";
import { InstallApp } from "@/components/InstallApp";
import { readAppearance, saveAppearance, type FontSize, type Theme } from "@/lib/appearance";

export default function ProfilePage() {
  const user = useRequireUser();
  if (!user) return <PageLoader />;
  return <ProfileForm key={user.id} />;
}

/** Sinfni faqat ota-ona o‘zgartira oladi: PIN-kod kiritilmaguncha tugmalar yopiq. */
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
      <p className="font-bold">{t("🔒 Sinfni faqat ota-ona o‘zgartira oladi.")}</p>
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

function ProfileForm() {
  const t = useT();
  const [parentUnlocked, setParentUnlocked] = useState(() => parentStore.get() !== null);
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user!.name);
  const [mascot, setMascot] = useState<MascotId | null>(user!.profile.mascot);
  const [grade, setGrade] = useState<Grade>(user!.profile.grade!);
  const [subject, setSubject] = useState<Subject>(user!.profile.subject!);
  const junior = user!.profile.module === "junior";
  const curriculum = useCurriculum();
  const subjectOptions = curriculum.subjects(grade);
  // Sinf almashganda fan sinfga mos bo‘lmasa, birinchi tayyor fan tanlanadi.
  const pickGrade = (g: Grade) => {
    setGrade(g);
    const options = curriculum.subjects(g);
    if (options.length && !options.some((o) => o.id === subject && o.ready)) setSubject((options.find((o) => o.ready) ?? options[0]).id);
  };
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
      await updateProfile({ name: name.trim(), ...(junior && mascot ? { mascot } : {}), grade, subject, soundEnabled: sound });
      setMsg({ tone: "info", text: t("✓ O‘zgarishlar saqlandi!") });
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setParentUnlocked(false); // ota-ona sessiyasi tugagan
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
            <div className="flex flex-wrap gap-2">
              {GRADES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => pickGrade(g.id)}
                  aria-pressed={grade === g.id}
                  disabled={!parentUnlocked}
                  className={`${chip(grade === g.id)} disabled:cursor-not-allowed ${parentUnlocked || grade === g.id ? "" : "disabled:opacity-50"}`}
                >
                  {t(g.title)}
                </button>
              ))}
            </div>
            {!parentUnlocked && <GradeLock onUnlocked={() => setParentUnlocked(true)} />}
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
      </main>
    </>
  );
}
