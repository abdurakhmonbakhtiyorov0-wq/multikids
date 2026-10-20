"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, childStore, parentStore, tokenStore, type Profile, type Settings, type User } from "./api";
import { ConsentGate } from "@/components/ConsentGate";
import { clearPwaCaches } from "@/components/PwaRegister";
import { hasStoredLocale, useI18n } from "@/lib/i18n";
import { useModule } from "@/lib/module-context";
import { moduleStore } from "@/lib/module";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, consent: boolean) => Promise<User>;
  logout: () => void;
  updateProfile: (patch: Partial<Profile> & Settings) => Promise<User>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setLocale } = useI18n();
  const { setModule } = useModule();

  // Sayt ko‘rinishi modulga qarab o‘zgaradi: foydalanuvchi sinfidan; sinf hali yo‘q bo‘lsa — bosh sahifada tanlangan modul.
  useEffect(() => {
    if (loading) return;
    setModule(user?.profile.module ?? moduleStore.get());
  }, [user, loading, setModule]);

  // Boshqa qurilmada tanlangan til (profilda saqlangan) — shu brauzerda til tanlanmagan bo‘lsagina qo‘llanadi
  useEffect(() => {
    const serverLocale = user?.child?.locale;
    if (serverLocale && serverLocale !== "uz" && !hasStoredLocale()) setLocale(serverLocale);
  }, [user, setLocale]);

  useEffect(() => {
    const request = tokenStore.get()
      ? api<{ user: User }>("/api/me").catch((e) => {
          // Saqlangan bola profili endi mavjud emas (o‘chirilgan): birinchi profilga qaytamiz.
          if (e?.status === 404 && childStore.get()) {
            childStore.set(null);
            return api<{ user: User }>("/api/me");
          }
          throw e;
        })
      : Promise.reject({ status: 0 });
    request
      .then((r) => setUser(r.user))
      .catch((e) => {
        if (e?.status === 401) tokenStore.set(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/api/auth/login", { method: "POST", body: { email, password } });
    tokenStore.set(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, consent: boolean) => {
    const r = await api<{ token: string; user: User }>("/api/auth/register", { method: "POST", body: { name, email, password, consent } });
    tokenStore.set(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.set(null);
    childStore.set(null);
    parentStore.set(null);
    moduleStore.set(null);
    clearPwaCaches();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch: Partial<Profile> & Settings) => {
    const r = await api<{ user: User }>("/api/me", { method: "PATCH", body: patch });
    setUser(r.user);
    return r.user;
  }, []);

  const acceptConsent = useCallback(async () => {
    const r = await api<{ user: User }>("/api/consent", { method: "POST", body: { accept: true } });
    setUser(r.user);
  }, []);

  /** Ball, daraja va kiyim o‘zgargandan keyin foydalanuvchi ma’lumotini serverdan yangilaydi. */
  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: User }>("/api/me");
      setUser(r.user);
    } catch {}
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, updateProfile, refresh }}>
      {children}
      {user?.needsConsent && <ConsentGate onAccept={acceptConsent} onLogout={logout} />}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

export function nextStepFor(user: User) {
  const p = user.profile;
  if (!p.grade || !p.subject) return "/onboarding";
  // Qahramon (3D do‘st) faqat boshlang‘ich modulda.
  if (p.module === "junior" && !p.mascot) return "/onboarding";
  return "/dashboard";
}

/** Himoyalangan sahifalar uchun: tizimga kirmaganni /login ga, onboardingni tugatmaganni /onboarding ga yo'naltiradi. */
export function useRequireUser({ onboarded = true } = {}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const ready = !!user && (!onboarded || nextStepFor(user) === "/dashboard");
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (onboarded && nextStepFor(user) !== "/dashboard") router.replace("/onboarding");
  }, [user, loading, onboarded, router]);
  return ready ? user : null;
}
