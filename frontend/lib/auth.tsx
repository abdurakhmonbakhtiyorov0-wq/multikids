"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, tokenStore, type Profile, type Settings, type User } from "./api";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  updateProfile: (patch: Partial<Profile> & Settings) => Promise<User>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const request = tokenStore.get() ? api<{ user: User }>("/api/me") : Promise.reject({ status: 0 });
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

  const register = useCallback(async (name: string, email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/api/auth/register", { method: "POST", body: { name, email, password } });
    tokenStore.set(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch: Partial<Profile> & Settings) => {
    const r = await api<{ user: User }>("/api/me", { method: "PATCH", body: patch });
    setUser(r.user);
    return r.user;
  }, []);

  /** Ball, daraja va kiyim o‘zgargandan keyin foydalanuvchi ma’lumotini serverdan yangilaydi. */
  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: User }>("/api/me");
      setUser(r.user);
    } catch {}
  }, []);

  return <Ctx.Provider value={{ user, loading, login, register, logout, updateProfile, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

export function nextStepFor(user: User) {
  if (!user.profile.mascot) return "/onboarding";
  if (!user.profile.grade || !user.profile.subject) return "/onboarding";
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
