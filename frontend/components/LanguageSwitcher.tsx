"use client";

import { useAuth } from "@/lib/auth";
import { LOCALES, useI18n } from "@/lib/i18n";

/** Til tanlagich: qurilmada saqlanadi va (kirgan bo‘lsa) bola profiliga ham yoziladi — boshqa qurilmada ham shu til chiqadi. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  const { user, updateProfile } = useAuth();
  return (
    <div role="radiogroup" aria-label="Til / Тил / Язык" className={`inline-flex overflow-hidden rounded-xl ring-2 ring-blue-100 ${className}`}>
      {LOCALES.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={locale === l.id}
          title={l.label}
          onClick={() => {
            setLocale(l.id);
            // Serverda faqat "uz" va "ru" saqlanadi (kirill — o‘zbek tilining yozuvi, matn mijozda o‘giriladi)
            if (user) void updateProfile({ locale: l.id === "ru" ? "ru" : "uz" }).catch(() => {});
          }}
          className={`px-2.5 py-1 text-xs font-extrabold ${locale === l.id ? "bg-blue-600 text-white" : "bg-white text-blue-800 hover:bg-blue-50"}`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
