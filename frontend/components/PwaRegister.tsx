"use client";

import { useEffect } from "react";

/** Service worker faqat production da ro‘yxatdan o‘tadi (dev da kesh chalkashligi bo‘lmasligi uchun). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

/** Chiqishda keshlangan sahifalarni tozalash. */
export function clearPwaCaches() {
  try {
    navigator.serviceWorker?.controller?.postMessage("clear-caches");
  } catch {}
}
