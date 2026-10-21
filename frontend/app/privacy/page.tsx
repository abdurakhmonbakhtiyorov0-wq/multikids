"use client";

import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import Link from "next/link";
import { Card, Logo, btnClass } from "@/components/ui";

export default function PrivacyPage() {
  const t = useT();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <Logo />
        <LanguageSwitcher />
      </div>
      <Card className="space-y-4">
        <h1 className="text-3xl font-black text-blue-950">{t("Maxfiylik siyosati")}</h1>
        <p className="text-sm font-bold text-slate-500">{t("Versiya: 2026-10")}</p>

        <section>
          <h2 className="text-xl font-black text-blue-900">{t("Qanday ma’lumotlar yig‘iladi")}</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
            <li>{t("Ota-onaning ismi, email manzili va parol (parol faqat shifrlangan holda saqlanadi).")}</li>
            <li>{t("Bola profili: ism yoki taxallus, sinf, tanlangan qahramon va fan, ovoz/til sozlamalari.")}</li>
            <li>{t("O‘quv faoliyati: test natijalari, javoblar, ballar, yutuqlar va kunlik seriya.")}</li>
          </ul>
          <p className="mt-2 text-slate-700">{t("Biz bolaning haqiqiy familiyasi, manzili, telefon raqami, fotosurati yoki joylashuvini so‘ramaymiz. Bola uchun taxallus ishlatish tavsiya etiladi.")}</p>
        </section>

        <section>
          <h2 className="text-xl font-black text-blue-900">{t("Nima uchun kerak")}</h2>
          <p className="text-slate-700">{t("Ma’lumotlar faqat o‘qish jarayonini ta’minlash, progressni saqlash va ota-onaga hisobot ko‘rsatish uchun ishlatiladi. Ular reklama uchun sotilmaydi va uchinchi shaxslarga berilmaydi.")}</p>
        </section>

        <section>
          <h2 className="text-xl font-black text-blue-900">{t("Ota-ona nazorati")}</h2>
          <p className="text-slate-700">{t("Bolaning natijalarini faqat ota-ona PIN-kod orqali ko‘ra oladi. Ota-ona istalgan vaqtda bola profilini yoki butun akkauntni o‘chirishi mumkin — shunda barcha bog‘liq ma’lumotlar (natijalar, xaridlar, yutuqlar) butunlay o‘chiriladi.")}</p>
        </section>

        <section>
          <h2 className="text-xl font-black text-blue-900">{t("Xavfsizlik")}</h2>
          <p className="text-slate-700">{t("Ma’lumotlar himoyalangan bazada saqlanadi, kirish urinishlari cheklanadi, har bir ota-ona faqat o‘z bolalarining ma’lumotlarini ko‘ra oladi.")}</p>
        </section>

        <section>
          <h2 className="text-xl font-black text-blue-900">{t("Rozilik")}</h2>
          <p className="text-slate-700">{t("Ro‘yxatdan o‘tishda ota-ona (vasiy) shu siyosatga rozilik bildiradi. Rozilik sanasi va versiyasi saqlanadi. Rozilikni qaytarib olish uchun akkauntni o‘chirish kifoya.")}</p>
        </section>

        <Link href="/" className={btnClass("secondary")}>
          {t("← Bosh sahifa")}
        </Link>
      </Card>
    </main>
  );
}
