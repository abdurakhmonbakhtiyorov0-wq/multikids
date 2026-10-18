"use client";

import Link from "next/link";
import { Card, Logo, btnClass } from "@/components/ui";

export default function ForgotPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-center">
        <Logo />
      </div>
      <Card>
        <h1 className="text-2xl font-black text-blue-950">Parolni tiklash</h1>
        <p className="mt-2 text-slate-600">
          Hozircha parol email orqali tiklanmaydi. Ota-onangiz yoki o‘qituvchingizdan sayt administratoriga murojaat qilishni so‘rang — u yangi parol o‘rnatib beradi.
        </p>
        <Link href="/login" className={`${btnClass("secondary")} mt-5 w-full`}>
          Kirish sahifasiga qaytish
        </Link>
      </Card>
    </main>
  );
}
