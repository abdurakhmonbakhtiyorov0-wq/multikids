"use client";

import { MODULES, type ModuleId } from "./data";
import { applyAppearance, readAppearance } from "./appearance";

const APPEARANCE_KEY = "multikids-appearance";

// Tanlangan modul: ro‘yxatdan o‘tishdan oldin bosh sahifada tanlanadi va qurilmada saqlanadi.
// Hisob yaratilgandan keyin modul sinfdan aniqlanadi (profile.module).
const KEY = "multikids-module";
const THEME_KEY = "multikids-module-theme";

export const isModuleId = (v: unknown): v is ModuleId => MODULES.some((m) => m.id === v);

export const moduleStore = {
  get: (): ModuleId | null => {
    try {
      const v = localStorage.getItem(KEY);
      return isModuleId(v) ? v : null;
    } catch {
      return null;
    }
  },
  set: (m: ModuleId | null) => {
    try {
      if (m) localStorage.setItem(KEY, m);
      else localStorage.removeItem(KEY);
    } catch {}
  },
};

/** Sahifa ko‘rinishini modulga moslaydi (rang, shrift, burchaklar — globals.css dagi [data-module]). */
export function applyModuleTheme(m: ModuleId | null) {
  document.documentElement.dataset.module = m ?? "junior";
  try {
    if (m) localStorage.setItem(THEME_KEY, m);
    else localStorage.removeItem(THEME_KEY);
    // Yuqori modul: foydalanuvchi mavzuni o‘zi tanlamagan bo‘lsa, qorong‘i (zamonaviy) ko‘rinish; boshqa modulda — oddiy hisob.
    if (!localStorage.getItem(APPEARANCE_KEY)) applyAppearance(m === "senior" ? { theme: "dark", size: "normal" } : readAppearance());
  } catch {}
}

/** Birinchi chizilishdan oldin: oxirgi modul mavzusini qo‘llaydi (miltillamasligi uchun). */
export const MODULE_BOOT_SCRIPT = `(function(){try{var e=document.documentElement;var m=localStorage.getItem("${THEME_KEY}");if(m==="junior"||m==="middle"||m==="senior"||m==="special")e.dataset.module=m;else e.dataset.module="junior";if(m==="senior"&&!localStorage.getItem("${APPEARANCE_KEY}"))e.dataset.theme="dark"}catch(x){}})()`;
