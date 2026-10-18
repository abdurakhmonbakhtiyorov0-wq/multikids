"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CHARACTER_BY_ID, REWARDS } from "@/lib/data";
import type { MascotProps, Mood } from "./three/Mascot";
import { MascotAvatar } from "./MascotAvatar";

const MascotScene = dynamic(() => import("./three/MascotScene"), {
  ssr: false,
  loading: () => <SceneLoading />,
});

function SceneLoading() {
  return (
    <div className="grid h-full place-items-center" role="status">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      <span className="sr-only">Qahramon yuklanmoqda…</span>
    </div>
  );
}

const MOOD_LABEL: Record<Mood, string> = {
  idle: "Xotirjam",
  thinking: "O‘ylayapti…",
  happy: "Xursand!",
  sad: "Biroz xafa",
  celebrating: "Bayram qilyapti!",
  wearing_rewards: "Mukofotlari bilan",
};

const noop = () => () => {};
let webglCache: boolean | undefined;
const webglSnapshot = () => (webglCache ??= hasWebGL());

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function MascotView(props: MascotProps & { className?: string; compact?: boolean }) {
  // Serverda null (yuklanish holati), brauzerda WebGL mavjudligi — gidratsiya nomuvofiqligisiz.
  const webgl = useSyncExternalStore(noop, webglSnapshot, () => null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    queueMicrotask(on);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const c = CHARACTER_BY_ID[props.id];
  return (
    <div className={`relative ${props.className ?? ""}`} aria-label={`${c.name}: ${MOOD_LABEL[props.mood]}`} role="img">
      {webgl === null ? (
        <SceneLoading />
      ) : webgl ? (
        <MascotScene {...props} reducedMotion={props.reducedMotion ?? reduced} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <MascotAvatar character={c} size={140} />
          <p className="text-sm text-slate-500">3D ko‘rinish bu qurilmada ishlamaydi, lekin darslar to‘liq ishlaydi.</p>
          <p className="text-2xl">{props.equipped.map((r) => REWARDS[r].emoji).join(" ")}</p>
        </div>
      )}
      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-blue-700 shadow-sm">
        {MOOD_LABEL[props.mood]}
      </span>
    </div>
  );
}
