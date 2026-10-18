"use client";

import { useState } from "react";
import { AppHeader, Alert, Button, Card, Field, PageLoader } from "@/components/ui";
import { MascotAvatar } from "@/components/MascotAvatar";
import { CHARACTERS, GRADES, SUBJECTS, type Grade, type MascotId, type Subject } from "@/lib/data";
import { useAuth, useRequireUser } from "@/lib/auth";

export default function ProfilePage() {
  const user = useRequireUser();
  if (!user) return <PageLoader />;
  return <ProfileForm key={user.id} />;
}

function ProfileForm() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user!.name);
  const [mascot, setMascot] = useState<MascotId>(user!.profile.mascot!);
  const [grade, setGrade] = useState<Grade>(user!.profile.grade!);
  const [subject, setSubject] = useState<Subject>(user!.profile.subject!);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  async function save() {
    if (name.trim().length < 2) return setMsg({ tone: "error", text: "Ism kamida 2 harfdan iborat bo‘lsin" });
    setBusy(true);
    setMsg(null);
    try {
      await updateProfile({ name: name.trim(), mascot, grade, subject });
      setMsg({ tone: "info", text: "✓ O‘zgarishlar saqlandi!" });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Saqlab bo‘lmadi" });
    } finally {
      setBusy(false);
    }
  }

  const chip = (on: boolean) => `rounded-2xl px-4 py-2 font-bold ring-2 transition ${on ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-slate-700 ring-blue-100 hover:ring-blue-300"}`;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-6">
        <h1 className="text-3xl font-black text-blue-950">Profil sozlamalari</h1>
        <Card className="space-y-6">
          <Field label="Ism" name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
          <p className="-mt-3 text-sm text-slate-500">Email: {user!.email}</p>
          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">Qahramon</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {CHARACTERS.map((c) => (
                <button key={c.id} onClick={() => setMascot(c.id)} aria-pressed={mascot === c.id} className={`flex flex-col items-center rounded-2xl p-2 ring-2 ${mascot === c.id ? "bg-blue-50 ring-blue-500" : "ring-blue-100 hover:ring-blue-300"}`}>
                  <MascotAvatar character={c} size={60} />
                  <span className="text-xs font-bold">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">Sinf</p>
            <div className="flex flex-wrap gap-2">
              {GRADES.map((g) => (
                <button key={g.id} onClick={() => setGrade(g.id)} aria-pressed={grade === g.id} className={chip(grade === g.id)}>
                  {g.title}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">Asosiy fan</p>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <button key={s.id} onClick={() => setSubject(s.id)} aria-pressed={subject === s.id} className={chip(subject === s.id)}>
                  {s.emoji} {s.title}
                </button>
              ))}
            </div>
          </div>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Button onClick={save} loading={busy}>
            Saqlash
          </Button>
        </Card>
      </main>
    </>
  );
}
