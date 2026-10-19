import { seededRandom } from "../quizEngine.js";

// Arifmetik savollar: javoblar kod orqali hisoblanadi, shuning uchun xato bo‘lishi mumkin emas.
// Seed doimiy — har safar bir xil ID va matnlar chiqadi (bazaga qayta yuklash xavfsiz).
const PER_LEVEL = 10;

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
    ],
    2: [
      (r) => { const a = int(r, 6, 12), b = int(r, 4, 9); return [`${a} + ${b} = ?`, a + b, `${a} + ${b} = ${a + b}.`]; },
      (r) => { const a = int(r, 11, 19), b = int(r, 3, 9); return [`${a} − ${b} = ?`, a - b, `${a} − ${b} = ${a - b}.`]; },
    ],
    3: [
      (r) => { const a = int(r, 3, 9), b = int(r, 5, 9), c = int(r, 1, 4); return [`${a} + ${b} − ${c} = ?`, a + b - c, `Avval ${a} + ${b} = ${a + b}, keyin ${c} ni ayiramiz: ${a + b - c}.`]; },
      (r) => { const a = int(r, 2, 9), s = a + int(r, 3, 9); return [`${a} + ? = ${s}. So‘roq belgisi o‘rnida qaysi son turadi?`, s - a, `${s} − ${a} = ${s - a}.`]; },
    ],
  },
  2: {
    1: [
      (r) => { const a = int(r, 10, 45), b = int(r, 10, 40); return [`${a} + ${b} = ?`, a + b, `${a} + ${b} = ${a + b}.`]; },
      (r) => { const a = int(r, 30, 90), b = int(r, 10, a - 5); return [`${a} − ${b} = ?`, a - b, `${a} − ${b} = ${a - b}.`]; },
    ],
    2: [
      (r) => { const a = int(r, 2, 5), b = int(r, 2, 9); return [`${a} × ${b} = ?`, a * b, `${a} ni ${b} marta qo‘shsak, ${a * b} bo‘ladi.`]; },
      (r) => { const a = int(r, 20, 60), b = int(r, 15, 39); return [`${a} + ${b} = ?`, a + b, `${a} + ${b} = ${a + b}.`]; },
    ],
    3: [
      (r) => { const b = int(r, 2, 5), q = int(r, 2, 9); return [`${b * q} ÷ ${b} = ?`, q, `${b} × ${q} = ${b * q}, demak ${b * q} ÷ ${b} = ${q}.`]; },
      (r) => { const a = int(r, 51, 95), b = int(r, 17, 48); return [`${a} − ${b} = ?`, a - b, `${a} − ${b} = ${a - b}.`]; },
    ],
  },
  3: {
    1: [
      (r) => { const a = int(r, 2, 9), b = int(r, 2, 9); return [`${a} × ${b} = ?`, a * b, `${a} × ${b} = ${a * b}.`]; },
      (r) => { const a = int(r, 100, 450), b = int(r, 100, 450); return [`${a} + ${b} = ?`, a + b, `${a} + ${b} = ${a + b}.`]; },
    ],
    2: [
      (r) => { const b = int(r, 3, 9), q = int(r, 3, 12); return [`${b * q} ÷ ${b} = ?`, q, `${b} × ${q} = ${b * q}, demak javob ${q}.`]; },
      (r) => { const a = int(r, 500, 900), b = int(r, 120, 480); return [`${a} − ${b} = ?`, a - b, `${a} − ${b} = ${a - b}.`]; },
    ],
    3: [
      (r) => { const a = int(r, 11, 25), b = int(r, 3, 9); return [`${a} × ${b} = ?`, a * b, `${a} × ${b} = ${a * b}.`]; },
      (r) => { const w = int(r, 3, 12), h = int(r, 3, 12); return [`To‘rtburchakning tomonlari ${w} sm va ${h} sm. Perimetri necha sm?`, 2 * (w + h), `P = 2 × (${w} + ${h}) = ${2 * (w + h)} sm.`]; },
    ],
  },
  4: {
    1: [
      (r) => { const a = int(r, 12, 30), b = int(r, 3, 9); return [`${a} × ${b} = ?`, a * b, `${a} × ${b} = ${a * b}.`]; },
      (r) => { const a = int(r, 1000, 4500), b = int(r, 1000, 4500); return [`${a} + ${b} = ?`, a + b, `${a} + ${b} = ${a + b}.`]; },
    ],
    2: [
      (r) => { const b = int(r, 4, 12), q = int(r, 11, 30); return [`${b * q} ÷ ${b} = ?`, q, `${b} × ${q} = ${b * q}, demak javob ${q}.`]; },
      (r) => { const w = int(r, 4, 15), h = int(r, 4, 15); return [`To‘g‘ri to‘rtburchakning eni ${w} sm, bo‘yi ${h} sm. Yuzi necha kv. sm?`, w * h, `S = ${w} × ${h} = ${w * h} kv. sm.`]; },
    ],
    3: [
      (r) => { const a = int(r, 21, 49), b = int(r, 12, 29); return [`${a} × ${b} = ?`, a * b, `${a} × ${b} = ${a * b}.`]; },
      (r) => { const a = int(r, 5000, 9000), b = int(r, 1500, 4900); return [`${a} − ${b} = ?`, a - b, `${a} − ${b} = ${a - b}.`]; },
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
      while (n < PER_LEVEL && guard++ < 500) {
        const [prompt, answer, explanation] = list[n % list.length](rand);
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
