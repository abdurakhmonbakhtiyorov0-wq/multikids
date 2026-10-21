"use client";

import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Card, Field, Logo, btnClass } from "@/components/ui";
import { api } from "@/lib/api";

export default function ForgotPage() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) return setError(t("Email manzilni kiriting"));
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/forgot", { method: "POST", body: { email } });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("So‘rovni yuborib bo‘lmadi"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <LanguageSwitcher />
      </div>
      <Card>
        <h1 className="text-2xl font-black text-blue-950">{t("Parolni tiklash")}</h1>
        {sent ? (
          <div className="mt-3 space-y-3">
            <Alert tone="info">{t("Agar bu email bilan hisob mavjud bo‘lsa, parolni tiklash havolasi yuborildi. Xat bir necha daqiqada keladi (30 daqiqa amal qiladi). “Spam” papkasini ham tekshiring.")}</Alert>
            <Link href="/login" className={`${btnClass("secondary")} w-full`}>
              {t("Kirish sahifasiga qaytish")}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="mt-3 space-y-4">
            <p className="text-slate-600">{t("Ro‘yxatdan o‘tgan email manzilingizni kiriting — parolni yangilash havolasini yuboramiz.")}</p>
            {error && <Alert>{error}</Alert>}
            <Field label={t("Email manzil")} name="email" type="email" autoComplete="email" placeholder={t("ota-ona@email.uz")} />
            <Button type="submit" loading={busy} className="w-full">
              {t("Havola yuborish")}
            </Button>
            <Link href="/login" className="block text-center text-sm font-semibold text-blue-700 hover:underline">
              {t("Kirish sahifasiga qaytish")}
            </Link>
          </form>
        )}
      </Card>
    </main>
  );
}
