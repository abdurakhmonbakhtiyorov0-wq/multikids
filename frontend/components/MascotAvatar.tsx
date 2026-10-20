import { useId } from "react";
import type { Character } from "@/lib/data";

/** Qahramon kartalari uchun yengil 2D SVG ko'rinish (har bir kartaga alohida WebGL ochmaslik uchun). */
function PandaAvatar({ size }: { size: number }) {
  const id = useId();
  const white = `${id}w`;
  const black = `${id}b`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id={white} cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe6f2" />
        </radialGradient>
        <radialGradient id={black} cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#4a4a57" />
          <stop offset="1" stopColor="#1c1c23" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="95" rx="28" ry="4" fill="#1e3a8a" opacity="0.14" />
      <ellipse cx="38" cy="90" rx="9.5" ry="6.5" fill={`url(#${black})`} />
      <ellipse cx="62" cy="90" rx="9.5" ry="6.5" fill={`url(#${black})`} />
      <ellipse cx="50" cy="73" rx="23" ry="20" fill={`url(#${white})`} />
      <ellipse cx="50" cy="76" rx="14" ry="13" fill="#f3eee2" opacity="0.8" />
      <path d="M27 62 Q50 74 73 62 L73 68 Q50 80 27 68 Z" fill={`url(#${black})`} />
      <ellipse cx="25" cy="72" rx="7.5" ry="13" transform="rotate(14 25 72)" fill={`url(#${black})`} />
      <ellipse cx="75" cy="72" rx="7.5" ry="13" transform="rotate(-14 75 72)" fill={`url(#${black})`} />
      {[27, 73].map((x) => (
        <g key={x}>
          <circle cx={x} cy="21" r="11" fill={`url(#${black})`} />
          <circle cx={x} cy="22" r="6.3" fill="#4a4a57" />
        </g>
      ))}
      <ellipse cx="50" cy="42" rx="29" ry="26" fill={`url(#${white})`} />
      {[0, 1].map((i) => (
        <ellipse key={i} cx={i ? 62 : 38} cy="41" rx="8" ry="11" transform={`rotate(${i ? -28 : 28} ${i ? 62 : 38} 41)`} fill={`url(#${black})`} />
      ))}
      {[40, 60].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="40" rx="5.3" ry="5.8" fill="#14141b" />
          <ellipse cx={x} cy="40.4" rx="3.5" ry="3.8" fill="#3d2b22" />
          <circle cx={x + 1.8} cy="37.6" r="1.8" fill="#fff" />
          <circle cx={x - 1.5} cy="42.4" r="0.8" fill="#fff" opacity="0.85" />
        </g>
      ))}
      <ellipse cx="50" cy="50" rx="4.6" ry="3.2" fill="#15151b" />
      <circle cx="48.6" cy="49" r="0.9" fill="#fff" opacity="0.85" />
      <path d="M50 53 L50 56 M43.5 56 Q50 62 56.5 56" stroke="#2a2a33" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="29.5" cy="56" rx="4.5" ry="3" fill="#ff9db4" opacity="0.55" />
      <ellipse cx="70.5" cy="56" rx="4.5" ry="3" fill="#ff9db4" opacity="0.55" />
    </svg>
  );
}

export function MascotAvatar({ character: c, size = 96 }: { character: Character; size?: number }) {
  if (c.extra === "panda") return <PandaAvatar size={size} />;
  const ear = c.ears === "floppy" ? c.accent : c.head;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <ellipse cx="50" cy="94" rx="26" ry="4" fill="#1e3a8a" opacity="0.12" />
      {c.ears === "round" && [28, 72].map((x) => <circle key={x} cx={x} cy="24" r="10" fill={ear} />)}
      {c.ears === "pointy" && [0, 1].map((i) => <path key={i} d={i ? "M62 26 L78 6 L80 34 Z" : "M38 26 L22 6 L20 34 Z"} fill={c.head} />)}
      {c.ears === "bunny" && [36, 64].map((x) => <ellipse key={x} cx={x} cy="14" rx="7" ry="16" fill={c.head} />)}
      {c.ears === "wide" &&
        [0, 1].map((i) => (
          <g key={i} transform={`rotate(${i ? 40 : -40} ${i ? 76 : 24} 34)`}>
            <ellipse cx={i ? 76 : 24} cy="34" rx="9" ry="19" fill={c.head} />
            <ellipse cx={i ? 76 : 24} cy="34" rx="5.5" ry="14" fill={c.accent} />
          </g>
        ))}
      {c.extra === "star" && <line x1="50" y1="16" x2="50" y2="10" stroke={c.limbs} strokeWidth="2.5" />}
      {c.extra === "star" && <path d="M50 1 L55 7 L50 13 L45 7 Z" fill="#ffd84d" />}
      {c.extra === "dragon" && [0, 1].map((i) => <path key={i} d={i ? "M60 22 L68 4 L70 26 Z" : "M40 22 L32 4 L30 26 Z"} fill={c.accent} />)}
      {c.extra === "robot" && <line x1="50" y1="16" x2="50" y2="4" stroke="#64748b" strokeWidth="3" />}
      {c.extra === "robot" && <circle cx="50" cy="4" r="4" fill="#38bdf8" />}
      <rect x="30" y="58" width="40" height="34" rx="18" fill={c.body} />
      {c.extra === "robot" ? <rect x="22" y="16" width="56" height="48" rx="10" fill={c.head} /> : <circle cx="50" cy="40" r="26" fill={c.head} />}
      {c.extra === "mario" && <path d="M24 36 Q50 4 76 36 Z" fill="#e0393e" />}
      {c.ears === "floppy" && [22, 78].map((x) => <ellipse key={x} cx={x} cy="42" rx="7" ry="13" fill={ear} />)}
      {c.extra === "minion" && <rect x="22" y="36" width="56" height="5" fill="#1f2937" />}
      {c.extra === "spider" ? (
        [0, 1].map((i) => <ellipse key={i} cx={i ? 60 : 40} cy="40" rx="7" ry="10" fill="#fff" stroke="#111827" strokeWidth="2.5" transform={`rotate(${i ? 25 : -25} ${i ? 60 : 40} 40)`} />)
      ) : (
        [42, 58].map((x) => (
          <g key={x}>
            {c.extra === "minion" && <circle cx={x} cy="39" r="7.5" fill="#cbd5e1" />}
            <circle cx={x} cy="39" r="5" fill={c.extra === "robot" ? "#0f172a" : "#fff"} />
            <circle cx={x} cy="40" r="3" fill={c.extra === "robot" ? "#38bdf8" : "#1e1b2e"} />
          </g>
        ))
      )}
      {c.extra === "mario" && <path d="M40 52 Q50 46 60 52" stroke="#3b2414" strokeWidth="4" fill="none" strokeLinecap="round" />}
      <path d="M43 52 Q50 58 57 52" stroke={c.extra === "robot" ? "#38bdf8" : "#3b1d1d"} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
