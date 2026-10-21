"use client";

import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Button } from "./ui";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** "Ilovani o‘rnatish": Chrome/Android uchun tugma, iPhone uchun ko‘rsatma. O‘rnatilgan bo‘lsa — ko‘rinmaydi. */
export function InstallApp() {
  const t = useT();
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    queueMicrotask(() => {
      setInstalled(window.matchMedia("(display-mode: standalone)").matches);
      setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    });
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (evt) {
    return (
      <Button
        variant="secondary"
        onClick={async () => {
          await evt.prompt();
          await evt.userChoice;
          setEvt(null);
        }}
      >
        {t("📲 Ilovani telefonga o‘rnatish")}
      </Button>
    );
  }
  if (ios) return <p className="text-sm text-slate-600">{t("📲 iPhone’da o‘rnatish: Safari’da “Ulashish” tugmasini bosing va “Bosh ekranga qo‘shish”ni tanlang.")}</p>;
  return null;
}
