"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toCyrillic } from "./translit";
import { RU, RU_PATTERNS } from "./i18n-ru";
import { useModule } from "./module-context";

/** Matndagi emoji va belgilarni olib tashlaydi ("⭐ 120 ball" -> "120 ball"). */
const stripEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/gu, "").trim();

// Interfeys tillari: o‘zbek (lotin, asosiy), o‘zbek (kirill) va rus.
// Matnlar manba tilida (o‘zbek lotin) yoziladi: t("Salom"). Kirill — avtomatik transliteratsiya, rus — lug‘at (i18n-ru.ts).
// Lug‘atda topilmagan matn o‘zgarishsiz (o‘zbekcha) qoladi — hech qachon bo‘sh yoki sinmaydi.

export type Locale = "uz" | "uz-cyrl" | "ru";
export const LOCALES: { id: Locale; label: string; short: string }[] = [
  { id: "uz", label: "O‘zbekcha", short: "UZ" },
  { id: "uz-cyrl", label: "Ўзбекча", short: "ЎЗ" },
  { id: "ru", label: "Русский", short: "RU" },
];

const KEY = "multikids-locale";
const HTML_LANG: Record<Locale, string> = { uz: "uz-Latn", "uz-cyrl": "uz-Cyrl", ru: "ru" };

let current: Locale = "uz";

export function readLocale(): Locale {
  try {
    const v = localStorage.getItem(KEY);
    return v === "ru" || v === "uz-cyrl" ? v : "uz";
  } catch {
    return "uz";
  }
}

type Vars = Record<string, string | number | null | undefined>;

/** {nom} o‘rinbosarlarini saqlagan holda matnni tarjima qiladi. */
export function translate(locale: Locale, text: string, vars?: Vars): string {
  let out: string;
  if (locale === "ru") {
    out = RU[text] ?? matchPattern(text) ?? text;
  } else if (locale === "uz-cyrl") {
    // O‘rinbosarlar ({name}) transliteratsiya qilinmaydi
    out = text
      .split(/(\{\w+\})/)
      .map((part) => (/^\{\w+\}$/.test(part) ? part : toCyrillic(part)))
      .join("");
  } else out = text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? "") : m));
  return out;
}

function matchPattern(text: string): string | null {
  for (const [re, tpl] of RU_PATTERNS) {
    const m = re.exec(text);
    // Ichki matnlar (masalan, talab matni) ham lug‘at orqali tarjima qilinadi
    if (m) return tpl.replace(/\$(\d)/g, (_, i) => RU[m[Number(i)]] ?? m[Number(i)] ?? "");
  }
  return null;
}

const DATE_LOCALE: Record<Locale, string> = { uz: "uz-UZ", "uz-cyrl": "uz-Cyrl-UZ", ru: "ru-RU" };
export const dateLocale = (l: Locale) => DATE_LOCALE[l];

/**
 * Savol/izoh matnlari (kontent). Kirill rejimida o‘zbek tilidagi fanlar o‘giriladi; ingliz va rus tili savollari
 * chet tilidagi so‘zlarni o‘z ichiga oladi, shuning uchun ular o‘zgarishsiz qoladi. Rus rejimida savollar o‘zbekcha qoladi.
 */
export function contentText(locale: Locale, text: string, subject?: string | null): string {
  if (locale !== "uz-cyrl" || subject === "english" || subject === "russian") return text;
  return toCyrillic(text);
}

/** React tashqarisidagi kod (masalan, API xatolari) uchun: joriy tilda tarjima. */
export const tr = (text: string, vars?: Vars) => translate(current, text, vars);

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: (text: string, vars?: Vars) => string };
const I18nCtx = createContext<Ctx | null>(null);

/** Brauzerda til hech qachon tanlanmagan bo‘lsa, bola profilidagi tilni (boshqa qurilmada tanlangan) qabul qilamiz. */
export const hasStoredLocale = () => {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return true;
  }
};

export function I18nProvider({ children, onChange }: { children: React.ReactNode; onChange?: (l: Locale) => void }) {
  const [locale, setLocaleState] = useState<Locale>("uz");

  useEffect(() => {
    const saved = readLocale();
    current = saved;
    document.documentElement.lang = HTML_LANG[saved];
    queueMicrotask(() => setLocaleState(saved));
  }, []);

  const setLocale = useCallback(
    (l: Locale) => {
      current = l;
      try {
        localStorage.setItem(KEY, l);
      } catch {}
      document.documentElement.lang = HTML_LANG[l];
      setLocaleState(l);
      onChange?.(l);
    },
    [onChange],
  );

  // Jiddiy modullarda (o‘rta, yuqori, maxsus) interfeys matnida emoji bo‘lmaydi.
  const { module } = useModule();
  const serious = module !== "junior";
  const value = useMemo<Ctx>(
    () => ({ locale, setLocale, t: (text, vars) => (serious ? stripEmoji(translate(locale, text, vars)) : translate(locale, text, vars)) }),
    [locale, setLocale, serious],
  );
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}

export const useT = () => useI18n().t;

/** Savol matnlari uchun: const ct = useContentT(subject); ct(q.prompt) */
export function useContentT(subject?: string | null) {
  const { locale } = useI18n();
  return useCallback((text: string) => contentText(locale, text, subject), [locale, subject]);
}
