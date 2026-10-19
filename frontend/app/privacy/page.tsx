"use client";

import Link from "next/link";
import { Card, Logo, btnClass } from "@/components/ui";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-8">
      <Logo />
      <Card className="space-y-4">
        <h1 className="text-3xl font-black text-blue-950">Maxfiylik siyosati</h1>
        <p className="text-sm font-bold text-slate-500">Versiya: 2026-10</p>

        <section>
          <h2 className="text-xl font-black text-blue-900">Qanday ma’lumotlar yig‘iladi</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
            <li>Ota-onaning ismi, email manzili va parol (parol faqat shifrlangan holda saqlanadi).</li>
            <li>Bola profili: ism yoki taxallus, sinf, tanlangan qahramon va fan, ovoz/til sozlamalari.</li>
            <li>O‘quv faoliyati: test natijalari, javoblar, ballar, yutuqlar va kunlik seriya.</li>
          </ul>
          <p className="mt-2 text-slate-700">Biz bolaning haqiqiy familiyasi, manzili, telefon raqami, fotosurati yoki joylashuvini so‘ramaymiz. Bola uchun taxallus ishlatish tavsiya etiladi.</p>
        </section>

        <section>
          <h2 className="text-xl font-black text-blue-900">Nima uchun kerak</h2>
          <p className="text-slate-700">Ma’lumotlar faqat o‘qish jarayonini ta’minlash, progressni saqlash va ota-onaga hisobot ko‘rsatish uchun ishlatiladi. Ular reklama uchun sotilmaydi va uchinchi shaxslarga berilmaydi.</p>
        </section>

        <section>
          <h2 className="text-xl font-black text-blue-900">Ota-ona nazorati</h2>
          <p className="text-slate-700">Bolaning natijalarini faqat ota-ona PIN-kod orqali ko‘ra oladi. Ota-ona istalgan vaqtda bola profilini yoki butun akkauntni o‘chirishi mumkin — shunda barcha bog‘liq ma’lumotlar (natijalar, xaridlar, yutuqlar) butunlay o‘chiriladi.</p>
        </section>

        <section>
          <h2 className="text-xl font-black text-blue-900">Xavfsizlik</h2>
          <p className="text-slate-700">Ma’lumotlar himoyalangan bazada saqlanadi, kirish urinishlari cheklanadi, har bir ota-ona faqat o‘z bolalarining ma’lumotlarini ko‘ra oladi.</p>
        </section>

        <section>
          <h2 className="text-xl font-black text-blue-900">Rozilik</h2>
          <p className="text-slate-700">Ro‘yxatdan o‘tishda ota-ona (vasiy) shu siyosatga rozilik bildiradi. Rozilik sanasi va versiyasi saqlanadi. Rozilikni qaytarib olish uchun akkauntni o‘chirish kifoya.</p>
        </section>

        <Link href="/" className={btnClass("secondary")}>
          ← Bosh sahifa
        </Link>
      </Card>
    </main>
  );
}
