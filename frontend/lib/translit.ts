// O‘zbek lotin → kirill (1995 alifbosi). Faqat interfeys matnlari uchun (savollar o‘zgartirilmaydi).

const SINGLE: Record<string, string> = {
  a: "а", b: "б", d: "д", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з", c: "ц", w: "в",
};

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** ‘ ’ ʻ ʼ ` ' belgilarini bitta ko‘rinishga keltiradi. */
const norm = (s: string) => s.replace(/[‘ʻʼ`´]/g, "’").replace(/'/g, "’");

export function toCyrillic(input: string): string {
  const src = norm(input);
  let out = "";
  let i = 0;
  const isLetter = (c: string | undefined) => !!c && /[A-Za-z’]/.test(c);
  while (i < src.length) {
    const ch = src[i];
    if (!/[A-Za-z]/.test(ch)) {
      out += ch === "’" ? "ъ" : ch;
      i++;
      continue;
    }
    const lower = ch.toLowerCase();
    const next = src[i + 1]?.toLowerCase();
    const upper = ch !== lower;
    const allCaps = upper && (src[i + 1] ?? "") !== "" && src[i + 1] === src[i + 1].toUpperCase() && /[A-Za-z]/.test(src[i + 1]);
    const put = (cyr: string) => {
      out += upper ? (allCaps ? cyr.toUpperCase() : upperFirst(cyr)) : cyr;
    };
    const wordStart = !isLetter(src[i - 1]);

    // o‘ va g‘ — alohida harflar
    if ((lower === "o" || lower === "g") && src[i + 1] === "’") {
      put(lower === "o" ? "ў" : "ғ");
      i += 2;
      continue;
    }
    if (lower === "s" && next === "h") { put("ш"); i += 2; continue; }
    if (lower === "c" && next === "h") { put("ч"); i += 2; continue; }
    if (lower === "y" && next === "o" && src[i + 2] !== "’") { put("ё"); i += 2; continue; }
    if (lower === "y" && next === "u") { put("ю"); i += 2; continue; }
    if (lower === "y" && next === "a") { put("я"); i += 2; continue; }
    if (lower === "y" && next === "e") { put(wordStart ? "е" : "йе"); i += 2; continue; }
    if (lower === "e") { put(wordStart ? "э" : "е"); i++; continue; }
    put(SINGLE[lower] ?? lower);
    i++;
  }
  return out;
}
