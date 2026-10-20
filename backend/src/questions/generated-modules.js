import { seededRandom } from "../quizEngine.js";
import { SPECIAL_GRADE } from "../curriculum.js";

// 5–11-sinf va SAT uchun hisoblab yaratiladigan savollar: javoblar kod orqali topiladi, shuning uchun xato bo‘lishi mumkin emas.
// Seed doimiy — har safar bir xil ID va matnlar chiqadi (bazaga qayta yuklash xavfsiz).
const PER_LEVEL = 14;

const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const SUP = { 2: "²", 3: "³", 4: "⁴" };
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n) => String(n).split("").map((d) => SUB[Number(d)]).join("");
/** Ishorali qo‘shiluvchi: sg(5) -> " + 5", sg(-5) -> " − 5". */
const sg = (n) => (n < 0 ? ` − ${-n}` : ` + ${n}`);
/** Koeffitsiyentli had: term(1,"x") -> "x", term(-3,"x") -> "−3x". */
const term = (c, v) => (c === 1 ? v : c === -1 ? `−${v}` : `${String(c).replace("-", "−")}${v}`);

/** Butun javob uchun uchta har xil noto‘g‘ri variant. */
function numWrongs(answer, r) {
  const mag = Math.max(1, Math.round(Math.abs(answer) / 8));
  const deltas = [-1, 1, -2, 2, 3, -3, 10, -10, mag, -mag, 2 * mag, -2 * mag];
  const out = new Set();
  let guard = 0;
  while (out.size < 3 && guard++ < 200) {
    const v = answer + pick(r, deltas);
    if (v !== answer) out.add(v);
  }
  let k = 4;
  while (out.size < 3) out.add(answer + k++);
  return [...out].map(String);
}

/** "Nπ" ko‘rinishidagi javob uchun noto‘g‘ri variantlar. */
function piWrongs(coef, r) {
  const out = new Set();
  let guard = 0;
  while (out.size < 3 && guard++ < 200) {
    const c = pick(r, [coef * 2, Math.max(1, Math.round(coef / 2)), coef + int(r, 1, 6), Math.max(1, coef - int(r, 1, 6)), coef * 3]);
    if (c !== coef && c > 0) out.add(c);
  }
  let k = 1;
  while (out.size < 3) out.add(coef + 7 * k++);
  return [...out].map((c) => `${c}π`);
}

// Savol yaratuvchilar: (r, p) => [matn, javob, izoh, (ixtiyoriy) noto‘g‘ri variantlar]
const F = {
  add: (r, p) => { const a = int(r, p.lo, p.hi), b = int(r, p.lo, p.hi); return [`${a} + ${b} = ?`, a + b, `${a} + ${b} = ${a + b}.`]; },
  sub: (r, p) => { const b = int(r, p.lo, p.hi), a = b + int(r, p.lo, p.hi); return [`${a} − ${b} = ?`, a - b, `${a} − ${b} = ${a - b}.`]; },
  mul: (r, p) => { const a = int(r, p.a[0], p.a[1]), b = int(r, p.b[0], p.b[1]); return [`${a} × ${b} = ?`, a * b, `${a} × ${b} = ${a * b}.`]; },
  percent: (r) => { const base = 20 * int(r, 2, 25), pc = pick(r, [10, 15, 20, 25, 30, 40, 50, 60, 75]); return [`${base} sonining ${pc}% i nechaga teng?`, (base * pc) / 100, `${base} × ${pc} ÷ 100 = ${(base * pc) / 100}.`]; },
  linEq: (r, p) => {
    const x = int(r, p.neg ? -9 : 1, 12), a = int(r, 2, p.big ? 12 : 9), b = int(r, 1, p.big ? 40 : 20), c = a * x + b;
    return [`${term(a, "x")}${sg(b)} = ${String(c).replace("-", "−")}. x nechaga teng?`, x, `${term(a, "x")} = ${c} − ${b} = ${c - b}, demak x = ${x}.`];
  },
  linEq2: (r, p) => {
    const x = int(r, p.neg ? -8 : 1, 10), c = int(r, 1, 6), a = c + int(r, 1, 7), b = int(r, -12, 15), d = a * x + b - c * x;
    return [`${term(a, "x")}${sg(b)} = ${term(c, "x")}${sg(d)}. x nechaga teng?`, x, `x larni bir tomonga yig‘amiz: ${a - c}x = ${d - b}, demak x = ${x}.`];
  },
  expr: (r) => { const a = int(r, 2, 9), b = int(r, 2, 12), c = int(r, 2, 12), d = int(r, 1, 20); return [`${a}(${b} + ${c}) − ${d} = ?`, a * (b + c) - d, `Avval qavs: ${b} + ${c} = ${b + c}, keyin ${a} ga ko‘paytiramiz va ${d} ni ayiramiz: ${a * (b + c) - d}.`]; },
  negInt: (r) => { const a = int(r, 3, 30), b = int(r, 3, 30); return [`−${a} + ${b} = ?`, b - a, `−${a} + ${b} = ${b - a}.`]; },
  squares: (r) => { const a = int(r, 3, 15), b = int(r, 2, 12); return [`${a}² + ${b}² = ?`, a * a + b * b, `${a}² = ${a * a}, ${b}² = ${b * b}, yig‘indisi ${a * a + b * b}.`]; },
  power: (r) => { const a = int(r, 2, 6), n = pick(r, [3, 4]); return [`${a}${SUP[n]} = ?`, a ** n, `${a} ni ${n} marta o‘ziga ko‘paytiramiz: ${a ** n}.`]; },
  sqrt: (r) => { const k = int(r, 2, 15), m = int(r, 2, 12); return [`√${k * k} + √${m * m} = ?`, k + m, `√${k * k} = ${k}, √${m * m} = ${m}, yig‘indisi ${k + m}.`]; },
  quadMax: (r, p) => {
    let a = int(r, p.neg ? -6 : 1, 9), b = int(r, 1, 10);
    if (a === b) b += 1;
    const S = a + b, P = a * b;
    return [`x² − ${S < 0 ? `(${String(S).replace("-", "−")})` : S}x${sg(P)} = 0 tenglamaning katta ildizi nechaga teng?`, Math.max(a, b), `Ildizlar ${a} va ${b} (yig‘indisi ${S}, ko‘paytmasi ${P}). Kattasi ${Math.max(a, b)}.`];
  },
  quadSum: (r) => { const a = int(r, -6, 10), b = int(r, -6, 10) + (int(r, 0, 1) ? 0 : 1); const S = a + b, P = a * b; return [`x²${sg(-S)}x${sg(P)} = 0 tenglamaning ildizlari yig‘indisi nechaga teng?`, S, `Viyet teoremasiga ko‘ra yig‘indi ikkinchi koeffitsiyentga qarama-qarshi ishora bilan teng: ${S}.`]; },
  ap: (r) => { const a = int(r, -5, 20), d = int(r, 2, 9), n = int(r, 5, 12); return [`Arifmetik progressiyada a${sub(1)} = ${String(a).replace("-", "−")}, d = ${d}. a${sub(n)} nechaga teng?`, a + (n - 1) * d, `a${sub(n)} = a${sub(1)} + (n − 1)d = ${a} + ${n - 1}·${d} = ${a + (n - 1) * d}.`]; },
  apSum: (r) => { const a = int(r, 1, 10), d = int(r, 1, 6), n = 2 * int(r, 3, 9); return [`Arifmetik progressiyada a${sub(1)} = ${a}, d = ${d}. Dastlabki ${n} ta hadining yig‘indisi S${sub(n)} nechaga teng?`, (n * (2 * a + (n - 1) * d)) / 2, `S = n(2a${sub(1)} + (n − 1)d) / 2 = ${n}(${2 * a} + ${(n - 1) * d}) / 2 = ${(n * (2 * a + (n - 1) * d)) / 2}.`]; },
  gp: (r) => { const b = int(r, 1, 6), q = pick(r, [2, 3]), n = int(r, 4, 6); return [`Geometrik progressiyada b${sub(1)} = ${b}, q = ${q}. b${sub(n)} nechaga teng?`, b * q ** (n - 1), `b${sub(n)} = b${sub(1)}·q^${n - 1} = ${b}·${q ** (n - 1)} = ${b * q ** (n - 1)}.`]; },
  deriv: (r, p) => { const a = int(r, 1, p.big ? 6 : 4), b = int(r, -8, 9), c = int(r, -9, 12), k = int(r, 1, p.big ? 7 : 4); return [`f(x) = ${term(a, "x²")}${sg(b).replace(/ [+−] 0$/, "")}x${sg(c)} funksiyaning x = ${k} nuqtadagi hosilasi f′(${k}) nechaga teng?`, 2 * a * k + b, `f′(x) = ${2 * a}x${sg(b)}, shuning uchun f′(${k}) = ${2 * a * k + b}.`]; },
  integral: (r) => { const a = int(r, 1, 6), k = int(r, 2, 6); return [`0 dan ${k} gacha ${2 * a}x ni integrallang: ∫ ${2 * a}x dx = ?`, a * k * k, `∫ ${2 * a}x dx = ${a}x², chegaralarda ${a}·${k}² = ${a * k * k}.`]; },
  logPow: (r, p) => { const b = pick(r, p.bases ?? [2, 3, 5]), k = int(r, 2, p.maxK ?? 5); return [`log${sub(b)} ${b ** k} = ?`, k, `${b}^${k} = ${b ** k}, demak log${sub(b)} ${b ** k} = ${k}.`]; },
  triAngle: (r) => { const a = int(r, 30, 80), b = int(r, 25, 70); return [`Uchburchakning ikki burchagi ${a}° va ${b}°. Uchinchi burchagi necha gradus?`, 180 - a - b, `180° − ${a}° − ${b}° = ${180 - a - b}°.`]; },
  suppl: (r) => { const a = int(r, 20, 160); return [`Qo‘shni burchaklardan biri ${a}° ga teng. Ikkinchisi necha gradus?`, 180 - a, `Qo‘shni burchaklar yig‘indisi 180°: 180° − ${a}° = ${180 - a}°.`]; },
  rectP: (r) => { const w = int(r, 3, 25), h = int(r, 3, 25); return [`To‘g‘ri to‘rtburchakning tomonlari ${w} sm va ${h} sm. Perimetri necha sm?`, 2 * (w + h), `P = 2(${w} + ${h}) = ${2 * (w + h)} sm.`]; },
  rectArea: (r) => { const w = int(r, 4, 25), h = int(r, 4, 25); return [`To‘g‘ri to‘rtburchakning tomonlari ${w} sm va ${h} sm. Yuzi necha kv. sm?`, w * h, `S = ${w} × ${h} = ${w * h} kv. sm.`]; },
  triArea: (r) => { const h = int(r, 3, 18), b = 2 * int(r, 2, 14); return [`Uchburchakning asosi ${b} sm, balandligi ${h} sm. Yuzi necha kv. sm?`, (b * h) / 2, `S = ${b} × ${h} ÷ 2 = ${(b * h) / 2} kv. sm.`]; },
  trapezoid: (r) => { const a = int(r, 3, 12), b = a + 2 * int(r, 1, 6), h = int(r, 3, 14); return [`Trapetsiyaning asoslari ${a} sm va ${b} sm, balandligi ${h} sm. Yuzi necha kv. sm?`, ((a + b) * h) / 2, `S = (${a} + ${b}) ÷ 2 × ${h} = ${((a + b) * h) / 2} kv. sm.`]; },
  pythagHyp: (r) => { const [a, b, c] = pick(r, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]]), k = int(r, 1, 4); return [`To‘g‘ri burchakli uchburchakning katetlari ${a * k} sm va ${b * k} sm. Gipotenuzasi necha sm?`, c * k, `${(a * k) ** 2} + ${(b * k) ** 2} = ${(c * k) ** 2}, demak gipotenuza ${c * k} sm.`]; },
  pythagLeg: (r) => { const [a, b, c] = pick(r, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]), k = int(r, 1, 4); return [`To‘g‘ri burchakli uchburchakning gipotenuzasi ${c * k} sm, katetlaridan biri ${a * k} sm. Ikkinchi kateti necha sm?`, b * k, `${(c * k) ** 2} − ${(a * k) ** 2} = ${(b * k) ** 2}, demak kateti ${b * k} sm.`]; },
  distance: (r) => { const [a, b, c] = pick(r, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10]]), x = int(r, -4, 4), y = int(r, -4, 4); return [`Koordinata tekisligida A(${String(x).replace("-", "−")}; ${String(y).replace("-", "−")}) va B(${String(x + a).replace("-", "−")}; ${String(y + b).replace("-", "−")}) nuqtalar orasidagi masofa nechaga teng?`, c, `Masofa = √(${a}² + ${b}²) = √${a * a + b * b} = ${c}.`]; },
  circleLen: (r) => { const R = int(r, 2, 15); return [`Radiusi ${R} sm bo‘lgan aylana uzunligini π orqali ifodalang.`, `${2 * R}π`, `C = 2πR = 2·${R}·π = ${2 * R}π (sm).`, piWrongs(2 * R, r)]; },
  circleArea: (r, p) => { const R = int(r, 2, p.maxR ?? 12); return [`Radiusi ${R} sm bo‘lgan doira yuzini π orqali ifodalang.`, `${R * R}π`, `S = πR² = π·${R}² = ${R * R}π (kv. sm).`, piWrongs(R * R, r)]; },
  cylVol: (r) => { const R = int(r, 2, 8), h = int(r, 2, 12); return [`Silindrning asos radiusi ${R} sm, balandligi ${h} sm. Hajmini π orqali ifodalang (kub sm).`, `${R * R * h}π`, `V = πR²h = π·${R}²·${h} = ${R * R * h}π.`, piWrongs(R * R * h, r)]; },
  sphereVol: (r) => { const R = 3 * int(r, 1, 4); return [`Sharning radiusi ${R} sm. Hajmini π orqali ifodalang (kub sm). V = 4πR³ / 3.`, `${(4 * R ** 3) / 3}π`, `V = 4π·${R ** 3} / 3 = ${(4 * R ** 3) / 3}π.`, piWrongs((4 * R ** 3) / 3, r)]; },
  cubeVol: (r) => { const a = int(r, 2, 14); return [`Kubning qirrasi ${a} sm. Hajmi necha kub sm?`, a ** 3, `V = a³ = ${a}³ = ${a ** 3}.`]; },
  cubeSurface: (r) => { const a = int(r, 2, 12); return [`Kubning qirrasi ${a} sm. To‘la sirti necha kv. sm?`, 6 * a * a, `S = 6a² = 6·${a * a} = ${6 * a * a}.`]; },
  ratio: (r) => { const a = int(r, 2, 9), b = a + int(r, 1, 6), k = int(r, 2, 9); return [`${a} : ${b} = ${a * k} : x proporsiyada x nechaga teng?`, b * k, `Proporsiya: x = ${b} × ${a * k} ÷ ${a} = ${b * k}.`]; },
  mean: (r) => {
    const m = int(r, 6, 40), d = [int(r, 1, 6), int(r, 1, 6)], nums = [m - d[0], m + d[0], m - d[1], m + d[1], m];
    return [`${nums.join(", ")} sonlarining o‘rta arifmetigi nechaga teng?`, m, `Yig‘indi ${nums.reduce((s, x) => s + x, 0)}, 5 ga bo‘lsak ${m}.`];
  },
  median: (r) => {
    const base = Array.from({ length: 5 }, () => int(r, 1, 40));
    const sorted = [...new Set(base)].sort((x, y) => x - y);
    while (sorted.length < 5) sorted.push(sorted[sorted.length - 1] + 1 + sorted.length);
    const shuffled = [...sorted].sort(() => r() - 0.5);
    return [`${shuffled.join(", ")} sonlarining medianasi nechaga teng?`, sorted[2], `Sonlarni o‘sish tartibida yozamiz: ${sorted.join(", ")}. O‘rtadagisi ${sorted[2]}.`];
  },
  system: (r) => { const x = int(r, 1, 15), y = int(r, 1, 12); return [`x + y = ${x + y} va x − y = ${x - y}. x nechaga teng?`, x, `Tenglamalarni qo‘shamiz: 2x = ${2 * x}, demak x = ${x}.`]; },
  word: (r) => { const fee = int(r, 10, 40), rate = int(r, 5, 25), h = int(r, 2, 12); return [`Usta chaqirish uchun $${fee} va har bir ish soati uchun $${rate} olinadi. Jami $${fee + rate * h} to‘langan bo‘lsa, usta necha soat ishlagan?`, h, `${fee} + ${rate}h = ${fee + rate * h}, shundan h = ${h}.`]; },
  slope: (r) => { const m = int(r, -5, 6) || 2, x1 = int(r, -4, 4), y1 = int(r, -6, 8), dx = int(r, 1, 5); return [`To‘g‘ri chiziq (${String(x1).replace("-", "−")}; ${String(y1).replace("-", "−")}) va (${String(x1 + dx).replace("-", "−")}; ${String(y1 + m * dx).replace("-", "−")}) nuqtalardan o‘tadi. Uning og‘ishi (burchak koeffitsiyenti) nechaga teng?`, m, `k = Δy / Δx = ${m * dx} / ${dx} = ${m}.`]; },
  speed: (r) => { const v = int(r, 30, 90), t = int(r, 2, 7); return [`Poyezd soatiga ${v} km tezlik bilan ${t} soat yurdi. U necha km yo‘l bosdi?`, v * t, `${v} × ${t} = ${v * t} km.`]; },
};

const W = { lo: 100, hi: 899 };

// Har bir (fan:sinf) uchun uch daraja bo‘yicha savol turlari.
const PLAN = {
  "mathematics:5": [
    [[F.add, W], [F.sub, W], [F.mul, { a: [12, 40], b: [3, 9] }]],
    [[F.percent, {}], [F.expr, {}], [F.mul, { a: [25, 99], b: [11, 25] }]],
    [[F.linEq, {}], [F.rectArea, {}], [F.power, {}]],
  ],
  "mathematics:6": [
    [[F.negInt, {}], [F.add, { lo: 1000, hi: 9000 }], [F.ratio, {}]],
    [[F.percent, {}], [F.linEq, { neg: true }], [F.expr, {}]],
    [[F.linEq2, {}], [F.mean, {}], [F.ratio, {}]],
  ],
  "algebra:7": [
    [[F.linEq, { neg: true }], [F.expr, {}], [F.squares, {}]],
    [[F.linEq2, {}], [F.sqrt, {}], [F.power, {}]],
    [[F.linEq2, { neg: true }], [F.linEq, { neg: true, big: true }], [F.percent, {}]],
  ],
  "algebra:8": [
    [[F.sqrt, {}], [F.linEq2, { neg: true }], [F.squares, {}]],
    [[F.quadSum, {}], [F.quadMax, {}], [F.ap, {}]],
    [[F.quadMax, { neg: true }], [F.apSum, {}], [F.system, {}]],
  ],
  "algebra:9": [
    [[F.quadMax, {}], [F.ap, {}], [F.sqrt, {}]],
    [[F.apSum, {}], [F.gp, {}], [F.quadSum, {}]],
    [[F.quadMax, { neg: true }], [F.gp, {}], [F.apSum, {}]],
  ],
  "algebra:10": [
    [[F.logPow, {}], [F.ap, {}], [F.quadMax, {}]],
    [[F.gp, {}], [F.logPow, { bases: [2, 3, 5, 10], maxK: 6 }], [F.deriv, {}]],
    [[F.deriv, { big: true }], [F.integral, {}], [F.apSum, {}]],
  ],
  "algebra:11": [
    [[F.logPow, { bases: [2, 3, 5, 10], maxK: 6 }], [F.deriv, {}], [F.gp, {}]],
    [[F.deriv, { big: true }], [F.integral, {}], [F.apSum, {}]],
    [[F.integral, {}], [F.deriv, { big: true }], [F.logPow, { bases: [2, 3, 5, 10], maxK: 6 }]],
  ],
  "geometry:7": [
    [[F.triAngle, {}], [F.suppl, {}], [F.rectP, {}]],
    [[F.rectArea, {}], [F.triArea, {}], [F.triAngle, {}]],
    [[F.pythagHyp, {}], [F.trapezoid, {}], [F.triArea, {}]],
  ],
  "geometry:8": [
    [[F.triArea, {}], [F.rectArea, {}], [F.pythagHyp, {}]],
    [[F.trapezoid, {}], [F.pythagLeg, {}], [F.distance, {}]],
    [[F.pythagLeg, {}], [F.distance, {}], [F.trapezoid, {}]],
  ],
  "geometry:9": [
    [[F.circleLen, {}], [F.circleArea, {}], [F.triArea, {}]],
    [[F.circleArea, {}], [F.distance, {}], [F.pythagLeg, {}]],
    [[F.cylVol, {}], [F.circleArea, { maxR: 20 }], [F.trapezoid, {}]],
  ],
  "geometry:10": [
    [[F.cubeVol, {}], [F.cubeSurface, {}], [F.circleArea, {}]],
    [[F.cylVol, {}], [F.sphereVol, {}], [F.pythagLeg, {}]],
    [[F.sphereVol, {}], [F.cylVol, {}], [F.distance, {}]],
  ],
  "geometry:11": [
    [[F.cubeSurface, {}], [F.cylVol, {}], [F.circleLen, {}]],
    [[F.sphereVol, {}], [F.cylVol, {}], [F.distance, {}]],
    [[F.sphereVol, {}], [F.cylVol, {}], [F.pythagLeg, {}]],
  ],
  [`sat-math:${SPECIAL_GRADE}`]: [
    [[F.linEq, { neg: true }], [F.percent, {}], [F.mean, {}]],
    [[F.system, {}], [F.word, {}], [F.slope, {}], [F.ratio, {}]],
    [[F.quadMax, { neg: true }], [F.distance, {}], [F.median, {}], [F.deriv, {}]],
  ],
};

export function generatedModuleQuestions() {
  const out = [];
  for (const [key, levels] of Object.entries(PLAN)) {
    const [subject, g] = key.split(":");
    const grade = Number(g);
    levels.forEach((makers, i) => {
      const difficulty = i + 1;
      const rand = seededRandom(`modules-gen:${key}:${difficulty}`);
      const seen = new Set();
      let n = 0;
      let guard = 0;
      while (n < PER_LEVEL && guard++ < 1500) {
        const [fn, params] = makers[guard % makers.length];
        const [prompt, answer, explanation, wrongs] = fn(rand, params);
        if (seen.has(prompt)) continue;
        const correct = String(answer).replace("-", "−");
        const options = [correct, ...(wrongs ?? numWrongs(answer, rand).map((w) => w.replace("-", "−")))];
        if (new Set(options).size !== options.length) continue;
        seen.add(prompt);
        n++;
        out.push({
          id: `${subject}-g${grade}-gen-${difficulty}${String(n).padStart(2, "0")}`,
          grade,
          subject,
          topic: "generated",
          difficulty,
          prompt,
          options,
          correctIndex: 0,
          explanation,
        });
      }
    });
  }
  return out;
}
