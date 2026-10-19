// Konfetti va qisqa ovozlar. Tashqi kutubxona va ovoz fayllari yo‘q: hammasi brauzer ichida chiziladi/sintez qilinadi.
// Tizimdagi "harakatni kamaytirish" sozlamasi hurmat qilinadi, ovoz foydalanuvchi sozlamasi bilan o‘chiriladi.

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const COLORS = ["#2563eb", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

type Particle = { x: number; y: number; vx: number; vy: number; size: number; color: string; rot: number; vr: number; life: number };

/** Ekran markazidan konfetti otadi. `power` 1 — oddiy, 2 — katta bayram. */
export function confetti(power = 1) {
  if (typeof document === "undefined" || prefersReducedMotion()) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "9999" });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const count = Math.round(70 * power);
  const parts: Particle[] = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const speed = 6 + Math.random() * 8 * power;
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.55,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1,
    };
  });

  let frame = 0;
  const tick = () => {
    frame++;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = 0;
    for (const p of parts) {
      p.vy += 0.28;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.009;
      if (p.life <= 0 || p.y > window.innerHeight + 20) continue;
      alive++;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (alive > 0 && frame < 400) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

let audio: AudioContext | null = null;

function ctxAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    audio ??= new AC();
    if (audio.state === "suspended") void audio.resume();
    return audio;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.12) {
  const a = ctxAudio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export type SoundKind = "correct" | "wrong" | "win" | "coin" | "levelup";

/** Qisqa ovoz. Brauzer avtomatik ovozni faqat foydalanuvchi harakatidan keyin ruxsat etadi — bu yerda har doim klikdan keyin chaqiriladi. */
export function playSound(kind: SoundKind, enabled: boolean) {
  if (!enabled) return;
  switch (kind) {
    case "correct":
      tone(659, 0, 0.12);
      tone(880, 0.1, 0.18);
      break;
    case "wrong":
      tone(220, 0, 0.22, "triangle", 0.1);
      break;
    case "coin":
      tone(988, 0, 0.08, "square", 0.06);
      tone(1319, 0.08, 0.2, "square", 0.06);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25));
      break;
    case "levelup":
      [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.22));
      break;
  }
}
