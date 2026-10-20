import type { Character } from "@/lib/data";

/** Qahramon kartalari uchun yengil 2D SVG ko'rinish (har bir kartaga alohida WebGL ochmaslik uchun). */
export function MascotAvatar({ character: c, size = 96 }: { character: Character; size?: number }) {
  const ear = c.extra === "panda" ? "#2b2b33" : c.ears === "floppy" ? c.accent : c.head;
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
      {c.extra === "panda" && [40, 60].map((x) => <ellipse key={x} cx={x} cy="40" rx="7" ry="9" fill="#2b2b33" />)}
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
