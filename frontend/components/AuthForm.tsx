"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { Alert, Button, Card, Field, Logo } from "./ui";
import { nextStepFor, useAuth } from "@/lib/auth";

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
  })
  .refine((d) => d.password === d.confirm, { message: "Parollar bir xil emas", path: ["confirm"] });

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { login, register, user, loading } = useAuth();
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && user && !busy) router.replace(nextStepFor(user));
  }, [user, loading, busy, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = (mode === "login" ? loginSchema : registerSchema).safeParse(data);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setServerError("");
    setBusy(true);
    try {
      const d = parsed.data as { name?: string; email: string; password: string };
      const u = mode === "login" ? await login(d.email, d.password) : await register(d.name!, d.email, d.password);
      if (mode === "register") {
        setSuccess(true);
        await new Promise((r) => setTimeout(r, 900));
      }
      router.replace(nextStepFor(u));
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Xatolik yuz berdi");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-center">
        <Logo />
      </div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <h1 className="text-2xl font-black text-blue-950">{mode === "login" ? "Qaytganingdan xursandmiz!" : "Xush kelibsiz!"}</h1>
          <p className="mb-5 mt-1 text-slate-500">{mode === "login" ? "Hisobingizga kiring" : "Yangi hisob yarating — bu bir daqiqa oladi"}</p>
          {success ? (
            <Alert tone="info">🎉 Ro‘yxatdan muvaffaqiyatli o‘tdingiz! Endi qahramon tanlaymiz…</Alert>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              {serverError && <Alert>{serverError}</Alert>}
              {mode === "register" && <Field label="Ismingiz" name="name" autoComplete="nickname" placeholder="Masalan: Aziz" error={errors.name} />}
              <Field label="Email manzil" name="email" type="email" autoComplete="email" placeholder="ota-ona@email.uz" error={errors.email} />
              <Field label="Parol" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} error={errors.password} />
              {mode === "register" && <Field label="Parolni tasdiqlang" name="confirm" type="password" autoComplete="new-password" error={errors.confirm} />}
              <Button type="submit" loading={busy} className="w-full">
                {mode === "login" ? "Kirish" : "Ro‘yxatdan o‘tish"}
              </Button>
            </form>
          )}
          <div className="mt-5 flex flex-col items-center gap-2 text-sm font-semibold text-slate-600">
            {mode === "login" ? (
              <>
                <Link href="/forgot" className="text-blue-700 hover:underline">
                  Parolni unutdingizmi?
                </Link>
                <span>
                  Hisobingiz yo‘qmi?{" "}
                  <Link href="/register" className="text-blue-700 hover:underline">
                    Ro‘yxatdan o‘ting
                  </Link>
                </span>
              </>
            ) : (
              <span>
                Hisobingiz bormi?{" "}
                <Link href="/login" className="text-blue-700 hover:underline">
                  Kirish
                </Link>
              </span>
            )}
          </div>
        </Card>
      </motion.div>
    </main>
  );
}
