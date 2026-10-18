"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; loading?: boolean };

const variants = {
  primary: "bg-blue-600 text-white shadow-[0_6px_0_#1e40af] hover:bg-blue-500 active:translate-y-[4px] active:shadow-[0_2px_0_#1e40af]",
  secondary: "bg-white text-blue-700 ring-2 ring-blue-200 shadow-[0_5px_0_#bfdbfe] hover:ring-blue-300 active:translate-y-[3px] active:shadow-[0_2px_0_#bfdbfe]",
  ghost: "text-blue-700 hover:bg-blue-50",
};

export const btnClass = (variant: keyof typeof variants = "primary") =>
  `inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 text-base font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]}`;

export function Button({ variant = "primary", loading, className = "", children, disabled, ...rest }: BtnProps) {
  return (
    <button className={`${btnClass(variant)} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-3xl bg-white p-5 shadow-[0_10px_30px_-12px_rgba(30,64,175,0.25)] ring-1 ring-blue-100 sm:p-6 ${className}`}>{children}</div>;
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-xl font-black text-blue-700">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-[0_4px_0_#1e40af]">M</span>
      MultiKids
    </Link>
  );
}

export function Field({
  label,
  error,
  type = "text",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const [show, setShow] = useState(false);
  const isPwd = type === "password";
  const id = rest.name;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPwd && show ? "text" : type}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={`h-13 w-full rounded-2xl border-2 bg-blue-50/40 px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:bg-white ${error ? "border-red-400" : "border-blue-100"}`}
          {...rest}
        />
        {isPwd && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-1.5 text-sm font-bold text-blue-700 hover:bg-blue-100"
            aria-label={show ? "Parolni yashirish" : "Parolni ko‘rsatish"}
          >
            {show ? "Yashirish" : "Ko‘rsatish"}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-1 text-sm font-semibold text-red-600">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}

export function Alert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" }) {
  return (
    <div role="alert" className={`rounded-2xl px-4 py-3 text-sm font-semibold ${tone === "error" ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-blue-50 text-blue-800 ring-1 ring-blue-200"}`}>
      {children}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="grid flex-1 place-items-center py-24" role="status">
      <div className="h-14 w-14 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      <span className="sr-only">Yuklanmoqda…</span>
    </div>
  );
}

export function AppHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/dashboard", label: "Bosh sahifa" },
    { href: "/progress", label: "Mening natijalarim" },
    { href: "/profile", label: "Profil" },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        {user && (
          <>
            <nav className="hidden items-center gap-1 md:flex">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-xl px-3 py-2 font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700">
                  {l.label}
                </Link>
              ))}
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="ml-2 rounded-xl px-3 py-2 font-bold text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                Chiqish
              </button>
            </nav>
            <button className="rounded-xl p-2 font-bold text-blue-700 ring-1 ring-blue-200 md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menyu">
              ☰
            </button>
          </>
        )}
      </div>
      {user && open && (
        <nav className="flex flex-col gap-1 border-t border-blue-100 px-4 py-2 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-bold text-slate-700 hover:bg-blue-50">
              {l.label}
            </Link>
          ))}
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="rounded-xl px-3 py-3 text-left font-bold text-red-600 hover:bg-red-50"
          >
            Chiqish
          </button>
        </nav>
      )}
    </header>
  );
}
