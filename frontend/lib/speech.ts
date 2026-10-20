"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Subject } from "./data";

// Savollarni ovoz chiqarib o‘qish (Web Speech API). Ovozlar qurilmadan olinadi.
// O‘zbekcha ovoz ko‘p qurilmalarda yo‘q, ruscha ovozda o‘zbekcha so‘zlar yomon eshitiladi — shuning uchun o‘zbekcha matn
// faqat haqiqiy o‘zbek ovozi bilan o‘qiladi. Faqat raqam va amallardan iborat savollar (masalan "12 : 4 = ?") ruscha ovoz
// bilan o‘qiladi, chunki ularda talaffuz muammosi yo‘q. Aks holda "ovoz yo‘q" belgisi ko‘rsatiladi.

const LANG_BY_SUBJECT: Record<Subject, string> = {
  mathematics: "uz",
  "native-language": "uz",
  reading: "uz",
  "natural-science": "uz",
  english: "en",
  russian: "ru",
};

export function speechLang(subject: Subject) {
  return LANG_BY_SUBJECT[subject];
}

const LETTERS_RU = ["А", "Бэ", "Цэ", "Дэ", "Е", "Эф"];
const LETTERS_LATIN = ["A", "B", "C", "D", "E", "F"];

/** Raqamli ifodani ruscha o‘qishga tayyorlaydi: belgilar so‘zga aylanadi. */
function mathToRussian(s: string) {
  return s
    .replace(/\s*[+]\s*/g, " плюс ")
    .replace(/\s*[−–-]\s*(?=\d|\?)/g, " минус ")
    .replace(/\s*[×*·]\s*/g, " умножить на ")
    .replace(/\s*[÷:/]\s*/g, " разделить на ")
    .replace(/\s*=\s*/g, " равно ")
    .replace(/\?/g, " сколько ");
}

export function useSpeech(lang: string) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const token = useRef(0);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    queueMicrotask(load);
    synth.addEventListener("voiceschanged", load);
    return () => {
      synth.removeEventListener("voiceschanged", load);
      synth.cancel();
    };
  }, [supported]);

  const exact = voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null;
  const fallback = lang === "uz" && !exact ? (voices.find((v) => v.lang.toLowerCase().startsWith("ru")) ?? null) : null;
  const voice = exact ?? fallback;

  const stop = useCallback(() => {
    token.current++;
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  /** Bu savolni shu qurilmada yaxshi o‘qib bo‘ladimi? (ruscha zaxira ovoz faqat raqamli matn uchun) */
  const canRead = useCallback(
    (prompt: string, options: string[]) => {
      if (!supported || !voice) return false;
      if (!fallback) return true;
      return ![prompt, ...options].some((x) => /[A-Za-z]/.test(x));
    },
    [supported, voice, fallback],
  );

  /** Savol va variantlarni harflari bilan o‘qiydi: "A. 13. Бэ. 14. ..." */
  const speak = useCallback(
    (prompt: string, options: string[]) => {
      if (!supported || !voice || !canRead(prompt, options)) return;
      const russian = voice.lang.toLowerCase().startsWith("ru");
      const letters = russian ? LETTERS_RU : LETTERS_LATIN;
      let text = `${prompt.replace(/\n/g, ". ")}. ${options.map((o, i) => `${letters[i] ?? i + 1}. ${o}.`).join(" ")}`;
      if (fallback) text = mathToRussian(text);
      const synth = window.speechSynthesis;
      synth.cancel();
      const my = ++token.current;
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.9; // kichik o‘quvchilar uchun sal sekinroq
      u.onstart = () => setSpeaking(true);
      u.onend = u.onerror = () => {
        if (token.current === my) setSpeaking(false);
      };
      synth.speak(u);
    },
    [supported, voice, fallback, canRead],
  );

  return { available: supported && !!voice, canRead, speaking, speak, stop };
}
