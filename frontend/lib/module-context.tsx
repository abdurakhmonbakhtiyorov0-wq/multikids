"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { applyModuleTheme, isModuleId } from "./module";
import type { ModuleId } from "./data";

// Joriy modul (rang, shrift va kayfiyatni belgilaydi). AuthProvider foydalanuvchi sinfidan, bosh sahifa esa
// tanlangan moduldan o‘rnatadi. I18nProvider shu qiymatga qarab jiddiy modullarda matndan emoji olib tashlaydi.
type Ctx = { module: ModuleId; setModule: (m: ModuleId | null) => void };
const ModuleCtx = createContext<Ctx>({ module: "junior", setModule: () => {} });

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [module, setState] = useState<ModuleId>("junior");

  // Boot skripti (layout) <html data-module> ni o‘rnatgan; React holatini unga moslaymiz.
  useEffect(() => {
    const m = document.documentElement.dataset.module;
    if (isModuleId(m) && m !== "junior") queueMicrotask(() => setState(m));
  }, []);

  const setModule = useCallback((m: ModuleId | null) => {
    setState(m ?? "junior");
    applyModuleTheme(m);
  }, []);

  const value = useMemo(() => ({ module, setModule }), [module, setModule]);
  return <ModuleCtx.Provider value={value}>{children}</ModuleCtx.Provider>;
}

export const useModule = () => useContext(ModuleCtx);
