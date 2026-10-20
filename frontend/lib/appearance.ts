"use client";

// Ko‘rinish sozlamalari (mavzu va shrift o‘lchami) shu qurilmada saqlanadi.
export type Theme = "light" | "dark" | "system";
export type FontSize = "normal" | "large" | "xlarge";

const KEY = "multikids-appearance";

export function readAppearance(): { theme: Theme; size: FontSize } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { theme: ["light", "dark", "system"].includes(v.theme) ? v.theme : "system", size: ["normal", "large", "xlarge"].includes(v.size) ? v.size : "normal" };
  } catch {
    return { theme: "system", size: "normal" };
  }
}

export function applyAppearance({ theme, size }: { theme: Theme; size: FontSize }) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.size = size;
}

export function saveAppearance(v: { theme: Theme; size: FontSize }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
  applyAppearance(v);
}

/** Sahifa chizilishidan oldin ishlaydigan qisqa skript (miltillashning oldini oladi). */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var v=JSON.parse(localStorage.getItem("${KEY}")||"{}");var d=v.theme==="dark"||((v.theme==="system"||!v.theme)&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.dataset.theme=d?"dark":"light";e.dataset.size=v.size||"normal"}catch(x){}})()`;
