"use client";

import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button, Card, Logo } from "@/components/ui";

export default function OfflinePage() {
  const t = useT();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <LanguageSwitcher />
      </div>
      <Card className="text-center">
        <p className="text-6xl" aria-hidden>
          📡
        </p>
        <h1 className="mt-2 text-2xl font-black text-blue-950">{t("Internet yo‘q")}</h1>
        <p className="mt-2 text-slate-600">
          {t("Testlar va natijalar serverda tekshiriladi va saqlanadi, shuning uchun ular uchun internet kerak. Aloqa tiklangach, davom etasiz — yechilgan javoblaringiz yo‘qolmaydi.")}
        </p>
        <Button className="mt-5 w-full" onClick={() => window.location.reload()}>
          {t("Qayta urinish")}
        </Button>
      </Card>
    </main>
  );
}
