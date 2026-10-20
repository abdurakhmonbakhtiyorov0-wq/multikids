"use client";

import { useT } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader, Alert, Button, Card, Field, PageLoader } from "@/components/ui";
import { SUBJECT_BY_ID, type Subject } from "@/lib/data";
import { api, ApiError, childStore, parentStore } from "@/lib/api";
import { dateLocale, useI18n } from "@/lib/i18n";
import { useAuth, useRequireUser } from "@/lib/auth";

type Overview = {
  child: { id: string; name: string; grade: number | null; subject: string | null; level: number; xp: number; balance: number; streak: number; bestStreak: number };
  totals: { tests: number; minutes: number; accuracy: number | null; activeDaysLast30: number };
  trend: number[];
  bySubject: { subject: Subject; grade: number; attempts: number; avgAccuracy: number; minutes: number; lastAt: string; reliable: boolean }[];
  missedQuestions: { id: string; subject: Subject; prompt: string; attempts: number; wrong: number }[];
  history: { id: string; date: string; subject: Subject; grade: number; title: string; accuracy: number; correct: number; total: number; score: number; maxScore: number; mark: number | null; minutes: number }[];
  achievements: { id: string; title: string; unlockedAt: string }[];
  notes: string[];
};
type Kid = { id: string; name: string; grade: number | null; level: number };

const fmtDate = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });

// ---------- PIN ----------
function PinGate({ hasPin, onUnlocked }: { hasPin: boolean; onUnlocked: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(!hasPin);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pin = String(fd.get("pin") ?? "");
    setBusy(true);
    setError("");
    try {
      if (creating) await api("/api/parent/pin", { method: "POST", body: { pin, password: String(fd.get("password") ?? "") } });
      const r = await api<{ parentToken: string; expiresIn: number }>("/api/parent/verify", { method: "POST", body: { pin } });
      parentStore.set(r.parentToken, r.expiresIn);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Xatolik yuz berdi"));
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-2xl font-black text-blue-950">{t("🔐 Ota-onalar uchun bo‘lim")}</h1>
      <p className="mt-1 text-slate-600">
        {creating ? t("Bolalar bu bo‘limga kira olmasligi uchun PIN-kod o‘rnating (4–6 raqam).") : t("Davom etish uchun PIN-kodni kiriting.")}
      </p>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label={creating ? t("Yangi PIN-kod") : t("PIN-kod")} name="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} />
        {creating && <Field label={t("Hisob paroli (tasdiqlash uchun)")} name="password" type="password" autoComplete="current-password" />}
        <Button type="submit" loading={busy} className="w-full">
          {creating ? t("PIN o‘rnatish va kirish") : t("Kirish")}
        </Button>
        {!creating && (
          <button type="button" className="w-full text-center text-sm font-semibold text-blue-700 hover:underline" onClick={() => setCreating(true)}>
            {t("PIN-kodni unutdim / almashtirmoqchiman")}
          </button>
        )}
      </form>
    </Card>
  );
}

// ---------- Diagramma ----------
function TrendChart({ values }: { values: number[] }) {
  const t = useT();
  if (values.length === 0) return <p className="text-slate-500">{t("Hali test topshirilmagan.")}</p>;
  return (
    <div role="img" aria-label={t("Oxirgi testlar aniqligi: {list}", { list: values.map((v) => `${v}%`).join(", ") })}>
      <div className="flex h-36 items-end gap-1.5 rounded-2xl bg-blue-50/60 p-3">
        {values.map((v, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-bold text-slate-600">{v}</span>
            <div className={`w-full rounded-t-lg ${v >= 75 ? "bg-emerald-500" : v >= 50 ? "bg-amber-400" : "bg-rose-400"}`} style={{ height: `${Math.max(4, v)}%` }} />
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">{t("Oxirgi {n} ta test (eskidan yangiga), aniqlik %.", { n: values.length })}</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="!p-4 text-center">
      <div className="text-2xl font-black text-blue-700">{value}</div>
      <div className="text-xs font-bold text-slate-500">{label}</div>
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </Card>
  );
}

// ---------- Boshqaruv ----------
function Manage({ kids, onChanged, onLocked }: { kids: Kid[]; onChanged: () => void; onLocked: () => void }) {
  const t = useT();
  const { logout } = useAuth();
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState("");

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) onLocked();
      setMsg({ tone: "error", text: err instanceof Error ? err.message : t("Xatolik yuz berdi") });
    } finally {
      setBusy("");
    }
  }

  return (
    <Card className="space-y-6">
      <h2 className="text-xl font-black text-blue-950">{t("⚙️ Boshqaruv")}</h2>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const form = e.currentTarget;
          run("add", async () => {
            await api("/api/children", { method: "POST", body: { name: String(fd.get("name") ?? "").trim(), grade: Number(fd.get("grade")) || undefined } });
            form.reset();
            setMsg({ tone: "info", text: t("✓ Bola profili qo‘shildi") });
            onChanged();
          });
        }}
      >
        <h3 className="font-extrabold text-blue-900">{t("Yangi bola profili")}</h3>
        <p className="text-xs text-slate-500">{t("Haqiqiy familiya o‘rniga taxallus ishlatishingiz mumkin.")}</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <Field label={t("Ism / taxallus")} name="name" maxLength={30} />
          <div>
            <label htmlFor="grade" className="mb-1.5 block text-sm font-bold text-slate-700">
              {t("Sinf")}
            </label>
            <select id="grade" name="grade" className="h-13 w-full rounded-2xl border-2 border-blue-100 bg-blue-50/40 px-3 py-3">
              <option value="">—</option>
              {[1, 2, 3, 4].map((g) => (
                <option key={g} value={g}>
                  {t("{n}-sinf", { n: g })}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" loading={busy === "add"} className="self-end">
            {t("Qo‘shish")}
          </Button>
        </div>
      </form>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const form = e.currentTarget;
          run("pin", async () => {
            await api("/api/parent/pin", { method: "POST", body: { pin: String(fd.get("pin") ?? ""), password: String(fd.get("password") ?? "") } });
            form.reset();
            setMsg({ tone: "info", text: t("✓ PIN-kod almashtirildi") });
          });
        }}
      >
        <h3 className="font-extrabold text-blue-900">{t("PIN-kodni almashtirish")}</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label={t("Yangi PIN")} name="pin" type="password" inputMode="numeric" maxLength={6} autoComplete="off" />
          <Field label={t("Hisob paroli")} name="password" type="password" autoComplete="current-password" />
          <Button type="submit" loading={busy === "pin"} className="self-end" variant="secondary">
            {t("Saqlash")}
          </Button>
        </div>
      </form>

      {kids.length > 1 && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const id = String(fd.get("kid"));
            run("delkid", async () => {
              await api(`/api/parent/children/${id}`, { method: "DELETE", body: { confirmName: String(fd.get("confirmName") ?? "") } });
              if (childStore.get() === id) childStore.set(null);
              setMsg({ tone: "info", text: t("✓ Profil va uning barcha ma’lumotlari o‘chirildi") });
              onChanged();
            });
          }}
        >
          <h3 className="font-extrabold text-rose-800">{t("Bola profilini o‘chirish")}</h3>
          <p className="text-xs text-slate-500">{t("Profilning barcha natijalari, ballari va xaridlari qaytarib bo‘lmaydigan tarzda o‘chiriladi.")}</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label htmlFor="kid" className="mb-1.5 block text-sm font-bold text-slate-700">
                {t("Profil")}
              </label>
              <select id="kid" name="kid" className="h-13 w-full rounded-2xl border-2 border-blue-100 bg-blue-50/40 px-3 py-3">
                {kids.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
            <Field label={t("Tasdiqlash: ismni yozing")} name="confirmName" autoComplete="off" />
            <Button type="submit" variant="secondary" loading={busy === "delkid"} className="self-end !text-rose-700">
              {t("O‘chirish")}
            </Button>
          </div>
        </form>
      )}

      <form
        className="space-y-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run("delacc", async () => {
            await api("/api/parent/account", { method: "DELETE", body: { password: String(fd.get("password") ?? ""), confirm: String(fd.get("confirm") ?? "") } });
            logout();
            router.replace("/");
          });
        }}
      >
        <h3 className="font-extrabold text-rose-800">{t("Akkauntni butunlay o‘chirish")}</h3>
        <p className="text-xs text-rose-900/80">{t("Akkaunt, barcha bola profillari va ularning ma’lumotlari qaytarib bo‘lmaydigan tarzda o‘chiriladi.")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Hisob paroli")} name="password" type="password" autoComplete="current-password" />
          <Field label={t("Tasdiqlash: email manzilingizni yozing")} name="confirm" autoComplete="off" />
        </div>
        <Button type="submit" loading={busy === "delacc"} className="!bg-rose-600 !shadow-[0_6px_0_#9f1239]">
          {t("Akkauntni o‘chirish")}
        </Button>
      </form>
    </Card>
  );
}

// ---------- Asosiy sahifa ----------
function Dashboard({ onLocked }: { onLocked: () => void }) {
  const t = useT();
  const { locale } = useI18n();
  const { user } = useAuth();
  const [kids, setKids] = useState<Kid[]>([]);
  const [selected, setSelected] = useState<string>(user?.child?.id ?? "");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  const loadKids = useCallback(async () => {
    const r = await api<{ children: Kid[]; activeId: string }>("/api/children");
    setKids(r.children);
    setSelected((cur) => (r.children.some((k) => k.id === cur) ? cur : r.activeId));
  }, []);

  useEffect(() => {
    queueMicrotask(() => loadKids().catch((e) => setError(e.message)));
  }, [loadKids]);

  useEffect(() => {
    if (!selected) return;
    api<Overview>(`/api/parent/overview?child=${selected}`)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 403) onLocked();
        else setError(e.message);
      });
  }, [selected, onLocked, kids.length]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-blue-950">{t("👨‍👩‍👧 Ota-onalar kabineti")}</h1>
        <Button variant="ghost" onClick={onLocked}>
          {t("🔒 Bo‘limni yopish")}
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}

      {kids.length > 0 && (
        <div role="tablist" aria-label={t("Bolalar")} className="flex flex-wrap gap-2">
          {kids.map((k) => (
            <button
              key={k.id}
              role="tab"
              aria-selected={selected === k.id}
              onClick={() => {
                setData(null);
                setSelected(k.id);
              }}
              className={`rounded-2xl px-4 py-2 font-extrabold ring-2 ${selected === k.id ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-blue-800 ring-blue-100 hover:ring-blue-300"}`}
            >
              {k.name}
              {k.grade ? ` · ${t("{n}-sinf", { n: k.grade })}` : ""}
            </button>
          ))}
        </div>
      )}

      {!data && !error && <PageLoader />}
      {data && (
        <>
          <section aria-label={t("Umumiy ko‘rsatkichlar")} className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label={t("Topshirilgan testlar")} value={data.totals.tests} />
            <Stat label={t("O‘rtacha aniqlik")} value={data.totals.accuracy === null ? "–" : `${data.totals.accuracy}%`} />
            <Stat label={t("Mashg‘ulot vaqti")} value={`${data.totals.minutes} daq`} hint="taxminiy" />
            <Stat label={t("Faol kunlar (30 kun)")} value={data.totals.activeDaysLast30} />
            <Stat label={t("Daraja · seriya")} value={`${data.child.level} · 🔥${data.child.streak}`} hint={t("eng uzun: {n} kun", { n: data.child.bestStreak })} />
          </section>

          <Card>
            <h2 className="mb-2 text-xl font-black text-blue-950">{t("📈 Aniqlik dinamikasi")}</h2>
            <TrendChart values={data.trend} />
          </Card>

          <Card>
            <h2 className="mb-2 text-xl font-black text-blue-950">{t("Fanlar bo‘yicha")}</h2>
            {data.bySubject.length === 0 ? (
              <p className="text-slate-500">{t("Hali ma’lumot yo‘q.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="py-2 pr-3">{t("Fan")}</th>
                      <th className="py-2 pr-3">{t("Testlar")}</th>
                      <th className="py-2 pr-3">{t("O‘rtacha aniqlik")}</th>
                      <th className="py-2 pr-3">{t("Vaqt")}</th>
                      <th className="py-2">{t("Izoh")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bySubject.map((s) => (
                      <tr key={`${s.subject}-${s.grade}`} className="border-t border-blue-50">
                        <td className="py-2 pr-3 font-bold">
                          {SUBJECT_BY_ID[s.subject].emoji} {t(SUBJECT_BY_ID[s.subject].title)} · {t("{n}-sinf", { n: s.grade })}
                        </td>
                        <td className="py-2 pr-3">{s.attempts}</td>
                        <td className="py-2 pr-3 font-black">{s.avgAccuracy}%</td>
                        <td className="py-2 pr-3">{t("{n} daq", { n: s.minutes })}</td>
                        <td className="py-2 text-xs text-slate-500">{s.reliable ? "" : t("Ma’lumot kam: kamida 3 ta test kerak")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 text-xl font-black text-blue-950">{t("Qiynalayotgan savollar")}</h2>
            {data.missedQuestions.length === 0 ? (
              <p className="text-slate-500">{t("Hozircha takroriy xatolar yo‘q.")}</p>
            ) : (
              <ul className="space-y-2 p-0">
                {data.missedQuestions.map((q) => (
                  <li key={q.id} className="list-none rounded-2xl bg-amber-50 p-3 text-sm">
                    <span className="font-bold text-amber-900">
                      {SUBJECT_BY_ID[q.subject].emoji} {q.prompt.replace(/\n/g, " ")}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      {t("{wrong} marta xato / {attempts} urinish", { wrong: q.wrong, attempts: q.attempts })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 text-xl font-black text-blue-950">{t("Testlar tarixi")}</h2>
            {data.history.length === 0 ? (
              <p className="text-slate-500">{t("Hali test topshirilmagan.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="py-2 pr-3">{t("Sana")}</th>
                      <th className="py-2 pr-3">{t("Fan")}</th>
                      <th className="py-2 pr-3">{t("Test")}</th>
                      <th className="py-2 pr-3">{t("To‘g‘ri")}</th>
                      <th className="py-2 pr-3">{t("Aniqlik")}</th>
                      <th className="py-2">{t("Vaqt")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h) => (
                      <tr key={h.id} className="border-t border-blue-50">
                        <td className="py-2 pr-3">{fmtDate(h.date, dateLocale(locale))}</td>
                        <td className="py-2 pr-3">{t(SUBJECT_BY_ID[h.subject].title)}</td>
                        <td className="py-2 pr-3">
                          {t(h.title)}
                          {h.mark ? ` (${t("baho")} ${h.mark})` : ""}
                        </td>
                        <td className="py-2 pr-3">
                          {h.correct}/{h.total}
                        </td>
                        <td className="py-2 pr-3 font-black">{h.accuracy}%</td>
                        <td className="py-2">{t("{n} daq", { n: h.minutes })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 text-xl font-black text-blue-950">{t("🏅 Yutuqlar")}</h2>
            {data.achievements.length === 0 ? (
              <p className="text-slate-500">{t("Hali yutuq yo‘q.")}</p>
            ) : (
              <ul className="flex flex-wrap gap-2 p-0">
                {data.achievements.map((a) => (
                  <li key={a.id} className="list-none rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">
                    {t(a.title)} · {fmtDate(a.unlockedAt, dateLocale(locale))}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <ul className="space-y-1 p-0 text-xs text-slate-500">
            {data.notes.map((n) => (
              <li key={n} className="list-none">
                ℹ️ {t(n)}
              </li>
            ))}
          </ul>
        </>
      )}

      <Manage kids={kids} onChanged={() => loadKids().catch((e) => setError(e.message))} onLocked={onLocked} />
    </div>
  );
}

export default function ParentPage() {
  const user = useRequireUser();
  const [unlocked, setUnlocked] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api<{ hasPin: boolean }>("/api/parent/status")
      .then((r) => {
        setHasPin(r.hasPin);
        setUnlocked(r.hasPin && !!parentStore.get());
      })
      .catch((e) => setError(e.message));
  }, [user]);

  const lock = useCallback(() => {
    parentStore.set(null);
    setUnlocked(false);
  }, []);

  if (!user) return <PageLoader />;
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        {error && <Alert>{error}</Alert>}
        {hasPin === null && !error && <PageLoader />}
        {hasPin !== null && !unlocked && <PinGate key={String(hasPin)} hasPin={hasPin} onUnlocked={() => { setHasPin(true); setUnlocked(true); }} />}
        {hasPin !== null && unlocked && <Dashboard onLocked={lock} />}
      </main>
    </>
  );
}
