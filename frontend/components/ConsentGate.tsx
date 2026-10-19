"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Card } from "./ui";

/** Roziligi yozilmagan (eski) akkauntlar uchun: ota-ona roziligini bermaguncha sayt ishlamaydi. */
export function ConsentGate({ onAccept, onLogout }: { onAccept: () => Promise<void>; onLogout: () => void }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setBusy(true);
    setError("");
    try {
      await onAccept();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rozilikni saqlab bo‘lmadi");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-blue-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <Card className="w-full max-w-md">
        <h2 id="consent-title" className="text-2xl font-black text-blue-950">
          Ota-ona roziligi
        </h2>
        <p className="mt-2 text-slate-600">
          MultiKids bolalar o‘qishi uchun mo‘ljallangan. Davom etishdan oldin ota-ona (vasiy) bolaning ma’lumotlari qanday saqlanishi bilan tanishib, rozilik berishi kerak.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-blue-600" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>
            Men bolaning ota-onasi (vasiysi)man va{" "}
            <Link href="/privacy" target="_blank" className="text-blue-700 underline">
              Maxfiylik siyosati
            </Link>
            ga roziman.
          </span>
        </label>
        {error && (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={accept} disabled={!checked} loading={busy}>
            Roziman
          </Button>
          <Button variant="ghost" onClick={onLogout}>
            Chiqish
          </Button>
        </div>
      </Card>
    </div>
  );
}
