"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n";

const ScienceScene = dynamic(() => import("./three/ScienceScene"), { ssr: false, loading: () => <div className="h-full w-full" aria-hidden /> });

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

/** Atom va DNK 3D vizualizatsiyasi (yuqori modul). WebGL bo‘lmasa — statik SVG. */
export function ScienceView({ className = "" }: { className?: string }) {
  const t = useT();
  const webgl = useSyncExternalStore(noop, webglSnapshot, () => null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    queueMicrotask(on);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return (
    <div className={`relative ${className}`} role="img" aria-label={t("Atom va DNK: ilmiy 3D tasvir")}>
      {webgl ? (
        <ScienceScene reducedMotion={reduced} />
      ) : (
        <svg viewBox="0 0 100 100" className="mx-auto h-full max-h-64" aria-hidden>
          <ellipse cx="50" cy="50" rx="44" ry="16" fill="none" stroke="#8f78ff" strokeWidth="2" />
          <ellipse cx="50" cy="50" rx="44" ry="16" fill="none" stroke="#5de0ff" strokeWidth="2" transform="rotate(60 50 50)" />
          <ellipse cx="50" cy="50" rx="44" ry="16" fill="none" stroke="#ff8fd0" strokeWidth="2" transform="rotate(120 50 50)" />
          <circle cx="50" cy="50" r="8" fill="#8f78ff" />
        </svg>
      )}
    </div>
  );
}
