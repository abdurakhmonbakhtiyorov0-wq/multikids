"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Card, Field, Logo, btnClass } from "@/components/ui";
import { api } from "@/lib/api";

export default function ResetPage() {
  // Token havoladan (?token=...) olinadi; brauzerda o‘qiladi, serverga faqat yangi parol bilan birga yuboriladi.
  const [token] = useState(() => (typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("token") ?? "")));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password.length < 6) return setError("Parol kamida 6 belgidan iborat bo‘lsin");
    if (password !== fd.get("confirm")) return setError("Parollar bir xil emas");
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/reset", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parolni yangilab bo‘lmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-center">
        <Logo />
      </div>
      <Card>
        <h1 className="text-2xl font-black text-blue-950">Yangi parol</h1>
        {done ? (
          <div className="mt-3 space-y-3">
            <Alert tone="info">✓ Parol yangilandi. Endi yangi parol bilan kirishingiz mumkin.</Alert>
            <Link href="/login" className={`${btnClass("primary")} w-full`}>
              Kirish
            </Link>
          </div>
        ) : !token ? (
          <div className="mt-3 space-y-3">
            <Alert>Havola noto‘g‘ri. Parolni tiklashni qaytadan so‘rang.</Alert>
            <Link href="/forgot" className={`${btnClass("secondary")} w-full`}>
              Qayta so‘rash
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="mt-3 space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Yangi parol" name="password" type="password" autoComplete="new-password" />
            <Field label="Parolni tasdiqlang" name="confirm" type="password" autoComplete="new-password" />
            <Button type="submit" loading={busy} className="w-full">
              Parolni yangilash
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
