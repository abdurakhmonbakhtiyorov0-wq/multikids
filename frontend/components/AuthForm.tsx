"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { Alert, Button, Card, Field, Logo } from "./ui";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { nextStepFor, useAuth } from "@/lib/auth";
import { MODULE_BY_ID, type ModuleId } from "@/lib/data";
import { isModuleId, moduleStore } from "@/lib/module";
import { useModule } from "@/lib/module-context";

const loginSchema = z.object({
  email: z.string().trim().email("Email manzilni to‘g‘ri kiriting"),
  password: z.string().min(1, "Parolni kiriting"),
});
const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Ism kamida 2 harfdan iborat bo‘lsin").max(30, "Ism juda uzun"),
    email: z.string().trim().email("Email manzilni to‘g‘ri kiriting"),
    password: z.string().min(6, "Parol kamida 6 belgidan iborat bo‘lsin"),
    confirm: z.string(),
    // Ota-ona roziligi faqat boshlang‘ich modulda (1–4-sinf) so‘raladi; tekshiruv onSubmit ichida.
    consent: z.string().optional(),
  })
  .refine((d) => d.password === d.confirm, { message: "Parollar bir xil emas", path: ["confirm"] });

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useT();
  const { login, register, user, loading } = useAuth();
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const { setModule } = useModule();
  const [chosen, setChosen] = useState<ModuleId | null>(null);
  // 1–4-sinf (yoki modul tanlanmagan): bola nomidan ota-ona rozilik beradi. 5-sinfdan SAT gacha: foydalanuvchining o‘zi,
  // ota-ona tasdig‘i so‘ralmaydi; ro‘yxatdan o‘tish Maxfiylik siyosatiga rozilik hisoblanadi.
  const needsParent = chosen === null || chosen === "junior";

  useEffect(() => {
    if (!loading && user && !busy) router.replace(nextStepFor(user));
  }, [user, loading, busy, router]);

  // Bosh sahifada tanlangan modul (?module=...) eslab qolinadi va ko‘rinish shunga moslanadi.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("module");
    if (isModuleId(fromUrl)) {
      moduleStore.set(fromUrl);
      setModule(fromUrl);
    }
    const m = isModuleId(fromUrl) ? fromUrl : moduleStore.get();
    queueMicrotask(() => setChosen(m));
  }, [setModule]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = (mode === "login" ? loginSchema : registerSchema).safeParse(data);
    const errs: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) errs[String(i.path[0])] ??= t(i.message);
    if (mode === "register" && needsParent && data.consent !== "on") errs.consent = t("Davom etish uchun ota-ona roziligi kerak");
    if (!parsed.success || Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setServerError("");
    setBusy(true);
    try {
      const d = parsed.data as { name?: string; email: string; password: string };
      const u = mode === "login" ? await login(d.email, d.password) : await register(d.name!, d.email, d.password, true);
      if (mode === "register") {
        setSuccess(true);
        await new Promise((r) => setTimeout(r, 900));
      }
      router.replace(nextStepFor(u));
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t("Xatolik yuz berdi"));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <LanguageSwitcher />
      </div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <h1 className="text-2xl font-black text-blue-950">{mode === "login" ? t("Qaytganingdan xursandmiz!") : t("Xush kelibsiz!")}</h1>
          <p className="mb-5 mt-1 text-slate-500">{mode === "login" ? t("Hisobingizga kiring") : t("Yangi hisob yarating — bu bir daqiqa oladi")}</p>
          {mode === "register" && chosen && (
            <p className="-mt-2 mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-900">
              <span>
                {t("Tanlangan modul:")} {t(MODULE_BY_ID[chosen].title)} ({t(MODULE_BY_ID[chosen].ages)})
              </span>
              <Link href="/" className="ml-auto text-blue-700 underline">
                {t("O‘zgartirish")}
              </Link>
            </p>
          )}
          {success ? (
            <Alert tone="info">{chosen && chosen !== "junior" ? t("🎉 Ro‘yxatdan muvaffaqiyatli o‘tdingiz! Endi sinf va fanni tanlaymiz…") : t("🎉 Ro‘yxatdan muvaffaqiyatli o‘tdingiz! Endi qahramon tanlaymiz…")}</Alert>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              {serverError && <Alert>{serverError}</Alert>}
              {mode === "register" && <Field label={t("Ismingiz")} name="name" autoComplete="nickname" placeholder={t("Masalan: Aziz")} error={errors.name} />}
              <Field label={t("Email manzil")} name="email" type="email" autoComplete="email" placeholder={t("ota-ona@email.uz")} error={errors.email} />
              <Field label={t("Parol")} name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} error={errors.password} />
              {mode === "register" && <Field label={t("Parolni tasdiqlang")} name="confirm" type="password" autoComplete="new-password" error={errors.confirm} />}
              {mode === "register" && !needsParent && (
                <p className="text-sm font-semibold text-slate-600">
                  {t("Ro‘yxatdan o‘tish orqali")}{" "}
                  <Link href="/privacy" target="_blank" className="text-blue-700 underline">
                    {t("Maxfiylik siyosati")}
                  </Link>
                  {t("ga rozilik bildirasiz.")}
                </p>
              )}
              {mode === "register" && needsParent && (
                <div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-slate-700">
                    <input type="checkbox" name="consent" className="mt-1 h-5 w-5 shrink-0 accent-blue-600" aria-invalid={!!errors.consent} />
                    <span>
                      {t("Men bolaning ota-onasi (vasiysi)man va")}{" "}
                      <Link href="/privacy" target="_blank" className="text-blue-700 underline">
                        {t("Maxfiylik siyosati")}
                      </Link>
                      {t("ga roziman.")}
                    </span>
                  </label>
                  {errors.consent && <p className="mt-1 text-sm font-semibold text-red-600">⚠ {errors.consent}</p>}
                </div>
              )}
              <Button type="submit" loading={busy} className="w-full">
                {mode === "login" ? t("Kirish") : t("Ro‘yxatdan o‘tish")}
              </Button>
            </form>
          )}
          <div className="mt-5 flex flex-col items-center gap-2 text-sm font-semibold text-slate-600">
            {mode === "login" ? (
              <>
                <Link href="/forgot" className="text-blue-700 hover:underline">
                  {t("Parolni unutdingizmi?")}
                </Link>
                <span>
                  {t("Hisobingiz yo‘qmi?")}{" "}
                  <Link href="/register" className="text-blue-700 hover:underline">
                    {t("Ro‘yxatdan o‘ting")}
                  </Link>
                </span>
              </>
            ) : (
              <span>
                {t("Hisobingiz bormi?")}{" "}
                <Link href="/login" className="text-blue-700 hover:underline">
                  {t("Kirish")}
                </Link>
              </span>
            )}
          </div>
        </Card>
      </motion.div>
    </main>
  );
}
