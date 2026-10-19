"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Subject } from "./data";

// Savollarni ovoz chiqarib o‘qish (Web Speech API). Ovozlar qurilmadan olinadi: o‘zbekcha ovoz ko‘p qurilmalarda yo‘q,
// shunda tugma ko‘rsatilmaydi — ishlamaydigan tugma qoldirilmaydi.

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

  const voice = voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null;

  const stop = useCallback(() => {
    token.current++;
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !voice) return;
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
    [supported, voice],
  );

  return { available: supported && !!voice, speaking, speak, stop };
}
