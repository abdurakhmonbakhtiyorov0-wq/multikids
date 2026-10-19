import { seededRandom } from "../quizEngine.js";

// Arifmetik savollar: javoblar kod orqali hisoblanadi, shuning uchun xato bo‘lishi mumkin emas.
// Seed doimiy — har safar bir xil ID va matnlar chiqadi (bazaga qayta yuklash xavfsiz).
const PER_LEVEL = 14;

function distractors(answer, rand, min = 0) {
  const out = new Set();
  const deltas = answer < 20 ? [-3, -2, -1, 1, 2, 3] : [-10, -2, -1, 1, 2, 10, 5, -5, 3, -3];
  let guard = 0;
  while (out.size < 3 && guard++ < 100) {
    const v = answer + deltas[Math.floor(rand() * deltas.length)];
    if (v !== answer && v >= min) out.add(v);
  }
  return [...out].map(String);
}

const int = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

// Har bir sinf va daraja (1..3) uchun savol yaratuvchilar: [matn, javob, izoh]
const makers = {
  1: {
    1: [
      (r) => { const a = int(r, 1, 9), b = int(r, 1, 9); return [`${a} + ${b} = ?`, a + b, `${a} ga ${b} ni qo‘shsak, ${a + b} bo‘ladi.`]; },
      (r) => { const a = int(r, 5, 12), b = int(r, 1, a - 1); return [`${a} − ${b} = ?`, a - b, `${a} dan ${b} ni ayirsak, ${a - b} qoladi.`]; },
      (r) => { const a = int(r, 1, 5), b = int(r, 1, 5); return [`Savatda ${a} ta olma bor edi. Yana ${b} ta qo‘shildi. Jami nechta olma bo‘ldi?`, a + b, `${a} + ${b} = ${a + b}.`]; },
    ],
    2: [
      (r) => { const a = int(r, 6, 12), b = int(r, 4, 9); return [`${a} + ${b} = ?`, a + b, `${a} + ${b} = ${a + b}.`]; },
      (r) => { const a = int(r, 11, 19), b = int(r, 3, 9); return [`${a} − ${b} = ?`, a - b, `${a} − ${b} = ${a - b}.`]; },
      (r) => { const a = int(r, 8, 15), b = int(r, 2, 7); return [`Qutida ${a} ta qalam bor edi. ${b} tasi olib qo‘yildi. Nechta qalam qoldi?`, a - b, `${a} − ${b} = ${a - b}.`]; },
    ],
    3: [
      (r) => { const a = int(r, 3, 9), b = int(r, 5, 9), c = int(r, 1, 4); return [`${a} + ${b} − ${c} = ?`, a + b - c, `Avval ${a} + ${b} = ${a + b}, keyin ${c} ni ayiramiz: ${a + b - c}.`]; },
      (r) => { const a = int(r, 2, 9), s = a + int(r, 3, 9); return [`${a} + ? = ${s}. So‘roq belgisi o‘rnida qaysi son turadi?`, s - a, `${s} − ${a} = ${s - a}.`]; },
      (r) => { const a = int(r, 2, 6), b = int(r, 2, 6), c = int(r, 2, 6); return [`${a} + ${b} + ${c} = ?`, a + b + c, `${a} + ${b} = ${a + b}, yana ${c} qo‘shamiz: ${a + b + c}.`]; },
    ],
  },
  2: {
    1: [
      (r) => { const a = int(r, 10, 45), b = int(r, 10, 40); return [`${a} + ${b} = ?`, a + b, `${a} + ${b} = ${a + b}.`]; },
      (r) => { const a = int(r, 30, 90), b = int(r, 10, a - 5); return [`${a} − ${b} = ?`, a - b, `${a} − ${b} = ${a - b}.`]; },
      (r) => { const a = int(r, 2, 5), b = int(r, 2, 5); return [`${a} ta qutida ${b} tadan qalam bor. Jami nechta qalam?`, a * b, `${a} × ${b} = ${a * b}.`]; },
    ],
    2: [
      (r) => { const a = int(r, 2, 5), b = int(r, 2, 9); return [`${a} × ${b} = ?`, a * b, `${a} ni ${b} marta qo‘shsak, ${a * b} bo‘ladi.`]; },
      (r) => { const a = int(r, 20, 60), b = int(r, 15, 39); return [`${a} + ${b} = ?`, a + b, `${a} + ${b} = ${a + b}.`]; },
      (r) => { const a = int(r, 3, 9), s = a + int(r, 10, 40); return [`${a} + ? = ${s}. So‘roq belgisi o‘rnida qaysi son turadi?`, s - a, `${s} − ${a} = ${s - a}.`]; },
    ],
    3: [
      (r) => { const b = int(r, 2, 5), q = int(r, 2, 9); return [`${b * q} ÷ ${b} = ?`, q, `${b} × ${q} = ${b * q}, demak ${b * q} ÷ ${b} = ${q}.`]; },
      (r) => { const a = int(r, 51, 95), b = int(r, 17, 48); return [`${a} − ${b} = ?`, a - b, `${a} − ${b} = ${a - b}.`]; },
      (r) => { const a = int(r, 2, 5), b = int(r, 2, 6), c = int(r, 3, 15); return [`${a} × ${b} + ${c} = ?`, a * b + c, `Avval ${a} × ${b} = ${a * b}, keyin ${c} ni qo‘shamiz: ${a * b + c}.`]; },
    ],
  },
  3: {
    1: [
      (r) => { const a = int(r, 2, 9), b = int(r, 2, 9); return [`${a} × ${b} = ?`, a * b, `${a} × ${b} = ${a * b}.`]; },
      (r) => { const a = int(r, 100, 450), b = int(r, 100, 450); return [`${a} + ${b} = ?`, a + b, `${a} + ${b} = ${a + b}.`]; },
      (r) => { const a = int(r, 3, 9), b = int(r, 3, 9); return [`Bir paketda ${a} ta konfet bor. ${b} ta paketda jami nechta konfet bor?`, a * b, `${a} × ${b} = ${a * b}.`]; },
    ],
    2: [
      (r) => { const b = int(r, 3, 9), q = int(r, 3, 12); return [`${b * q} ÷ ${b} = ?`, q, `${b} × ${q} = ${b * q}, demak javob ${q}.`]; },
      (r) => { const a = int(r, 500, 900), b = int(r, 120, 480); return [`${a} − ${b} = ?`, a - b, `${a} − ${b} = ${a - b}.`]; },
      (r) => { const a = int(r, 5, 30), b = int(r, 2, 6), c = int(r, 2, 6); return [`${a} + ${b} × ${c} = ?`, a + b * c, `Avval ko‘paytiramiz: ${b} × ${c} = ${b * c}, keyin ${a} ni qo‘shamiz: ${a + b * c}.`]; },
    ],
    3: [
      (r) => { const a = int(r, 11, 25), b = int(r, 3, 9); return [`${a} × ${b} = ?`, a * b, `${a} × ${b} = ${a * b}.`]; },
      (r) => { const w = int(r, 3, 12), h = int(r, 3, 12); return [`To‘rtburchakning tomonlari ${w} sm va ${h} sm. Perimetri necha sm?`, 2 * (w + h), `P = 2 × (${w} + ${h}) = ${2 * (w + h)} sm.`]; },
      (r) => { const w = int(r, 3, 12), h = int(r, 3, 12); return [`To‘g‘ri to‘rtburchakning eni ${w} sm, bo‘yi ${h} sm. Yuzi necha kv. sm?`, w * h, `S = ${w} × ${h} = ${w * h} kv. sm.`]; },
    ],
  },
  4: {
    1: [
      (r) => { const a = int(r, 12, 30), b = int(r, 3, 9); return [`${a} × ${b} = ?`, a * b, `${a} × ${b} = ${a * b}.`]; },
      (r) => { const a = int(r, 1000, 4500), b = int(r, 1000, 4500); return [`${a} + ${b} = ?`, a + b, `${a} + ${b} = ${a + b}.`]; },
      (r) => { const a = int(r, 200, 500), b = int(r, 50, 190); return [`Do‘konda ${a} kg olma bor edi. ${b} kg sotildi. Necha kg qoldi?`, a - b, `${a} − ${b} = ${a - b}.`]; },
    ],
    2: [
      (r) => { const b = int(r, 4, 12), q = int(r, 11, 30); return [`${b * q} ÷ ${b} = ?`, q, `${b} × ${q} = ${b * q}, demak javob ${q}.`]; },
      (r) => { const w = int(r, 4, 15), h = int(r, 4, 15); return [`To‘g‘ri to‘rtburchakning eni ${w} sm, bo‘yi ${h} sm. Yuzi necha kv. sm?`, w * h, `S = ${w} × ${h} = ${w * h} kv. sm.`]; },
      (r) => { const v = int(r, 20, 80), t = int(r, 2, 6); return [`Avtomobil soatiga ${v} km tezlik bilan ${t} soat yurdi. U necha km yo‘l bosdi?`, v * t, `${v} × ${t} = ${v * t} km.`]; },
    ],
    3: [
      (r) => { const a = int(r, 21, 49), b = int(r, 12, 29); return [`${a} × ${b} = ?`, a * b, `${a} × ${b} = ${a * b}.`]; },
      (r) => { const a = int(r, 5000, 9000), b = int(r, 1500, 4900); return [`${a} − ${b} = ?`, a - b, `${a} − ${b} = ${a - b}.`]; },
      (r) => { const a = int(r, 12, 40), b = int(r, 8, 30), c = int(r, 3, 9); return [`(${a} + ${b}) × ${c} = ?`, (a + b) * c, `Avval qavs ichi: ${a} + ${b} = ${a + b}, keyin ${c} ga ko‘paytiramiz: ${(a + b) * c}.`]; },
    ],
  },
};

export function generatedMathQuestions() {
  const out = [];
  for (const grade of [1, 2, 3, 4]) {
    for (const difficulty of [1, 2, 3]) {
      const rand = seededRandom(`math-gen:${grade}:${difficulty}`);
      const seen = new Set();
      const list = makers[grade][difficulty];
      let n = 0;
      let guard = 0;
      while (n < PER_LEVEL && guard++ < 800) {
        const [prompt, answer, explanation] = list[guard % list.length](rand);
        if (seen.has(prompt)) continue;
        seen.add(prompt);
        n++;
        out.push({
          id: `mathematics-g${grade}-gen-${difficulty}${String(n).padStart(2, "0")}`,
          grade,
          subject: "mathematics",
          topic: "arithmetic",
          difficulty,
          prompt,
          options: [String(answer), ...distractors(answer, rand)],
          correctIndex: 0,
          explanation,
        });
      }
    }
  }
  return out;
}
