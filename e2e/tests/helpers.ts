import { expect, type Page, type APIRequestContext } from "@playwright/test";

export const API = "http://localhost:4100";
const ORACLE = "http://localhost:4101";
const TOKEN_KEY = "bilimdon-token";

const SUBJECT_IDS: Record<string, string> = {
  Matematika: "mathematics",
  "Ona tili": "native-language",
  "O‘qish": "reading",
  "Tabiiy fanlar": "natural-science",
  "Ingliz tili": "english",
  "Rus tili": "russian",
  Algebra: "algebra",
  Geometriya: "geometry",
  Fizika: "physics",
  Kimyo: "chemistry",
  Biologiya: "biology",
  Tarix: "history",
  Geografiya: "geography",
  Adabiyot: "literature",
  Informatika: "informatics",
  "SAT Math": "sat-math",
  "SAT Reading & Writing": "sat-reading",
};

let counter = 0;
export const uniqueEmail = (p = "e2e") => `${p}${Date.now()}${++counter}@example.com`;

/** Akkaunt yaratadi (API orqali, tezroq) va sahifani shu akkauntda ochilgan holatga keltiradi. */
export async function loginViaApi(page: Page, request: APIRequestContext, profile: Record<string, unknown> = { grade: 3, subject: "mathematics", mascot: "pandacha" }) {
  const email = uniqueEmail();
  const r = await request.post(`${API}/api/auth/register`, { data: { name: "Aziz", email, password: "secret123", consent: true } });
  expect(r.ok()).toBeTruthy();
  const { token } = await r.json();
  await request.patch(`${API}/api/me`, { data: profile, headers: { Authorization: `Bearer ${token}` } });
  await page.addInitScript(([k, t]) => localStorage.setItem(k, t), [TOKEN_KEY, token]);
  return { email, token };
}

/** Test sahifasi sarlavhasidan ("🔢 Matematika · 3-sinf · ...", "SAT Math · SAT · ...") sinf va fan ID sini o‘qiydi. */
async function quizContext(page: Page) {
  const line = (await page.locator("main").getByText(/(-sinf|· SAT) ·/).first().textContent()) ?? "";
  const grade = /· SAT ·/.test(line) ? 12 : Number(/(\d+)-sinf/.exec(line)?.[1] ?? 0);
  // Uzun nomlar oldin tekshiriladi ("SAT Reading & Writing" — "Reading" dan oldin)
  const title = Object.keys(SUBJECT_IDS)
    .sort((a, b) => b.length - a.length)
    .find((t) => line.includes(t));
  return { grade, subject: title ? SUBJECT_IDS[title] : "mathematics" };
}

/** Ko‘rinib turgan savolning to‘g‘ri javob matnini oracle'dan oladi va shu variantni (yoki ataylab xatosini) bosadi. */
export async function answerCurrent(page: Page, { wrong = false } = {}) {
  await expect(page.locator("main h1").first()).toBeVisible();
  // Savol almashganda eski savol animatsiya bilan chiqib ketayotgan bo‘lishi mumkin. Sarlavha va variantlarni
  // BIR lahzada (bitta evaluate) o‘qiymiz, variantlar faol bo‘lgunicha kutamiz va tanlovni ham shu yerda belgilaymiz.
  let info = { prompt: "", texts: [] as string[], rightIdx: -1, correct: [] as string[] };
  await expect(async () => {
    const snap = await page.evaluate(() => {
      const main = document.querySelector("main");
      const h1 = main?.querySelector("h1");
      const opts = [...(main?.querySelectorAll("button") ?? [])].filter((b) => /^[A-D✓✗]$/.test(b.children[0]?.textContent?.trim() ?? ""));
      return {
        prompt: (h1?.textContent ?? "").trim(),
        texts: opts.map((b) => (b.textContent ?? "").trim().slice((b.children[0]?.textContent ?? "").trim().length).trim()),
        enabled: opts.length >= 3 && opts.every((b) => !(b as HTMLButtonElement).disabled),
        img: main?.querySelector("img[src^='/questions/']")?.getAttribute("src") ?? null,
      };
    });
    expect(snap.enabled, "variantlar hali faol emas").toBeTruthy();
    const { grade, subject } = await quizContext(page);
    const query = new URLSearchParams({ prompt: snap.prompt, grade: String(grade), subject, ...(snap.img ? { img: snap.img } : {}) });
    const { correct } = (await (await fetch(`${ORACLE}/answer?${query}`)).json()) as { correct: string[] };
    const rightIdx = snap.texts.findIndex((x) => correct.includes(x));
    expect(rightIdx, `to‘g‘ri variant topilmadi: ${snap.prompt} :: ${correct} / ${snap.texts}`).toBeGreaterThanOrEqual(0);
    const pick = wrong ? (rightIdx + 1) % snap.texts.length : rightIdx;
    // Tanlovni belgilaymiz — faqat savol hali o‘sha bo‘lsa va variantlar faol bo‘lsa
    const marked = await page.evaluate(
      ({ prompt, pick }) => {
        const main = document.querySelector("main");
        if ((main?.querySelector("h1")?.textContent ?? "").trim() !== prompt) return false;
        const opts = [...(main?.querySelectorAll("button") ?? [])].filter((b) => /^[A-D✓✗]$/.test(b.children[0]?.textContent?.trim() ?? ""));
        if (!opts[pick] || (opts[pick] as HTMLButtonElement).disabled) return false;
        document.querySelectorAll("[data-e2e-pick]").forEach((e) => e.removeAttribute("data-e2e-pick"));
        opts[pick].setAttribute("data-e2e-pick", "1");
        return true;
      },
      { prompt: snap.prompt, pick },
    );
    expect(marked, "savol almashdi").toBeTruthy();
    info = { prompt: snap.prompt, texts: snap.texts, rightIdx, correct };
  }).toPass({ timeout: 15_000 });

  await page.locator("[data-e2e-pick]").click({ timeout: 5000 });
  // Kutilgan natija chiqdimi? (noto‘g‘ri bo‘lsa, sababi aniq ko‘rsatiladi)
  const verdict = page.getByText(/To‘g‘ri javob!|To‘g‘ri! |Yana bir bor urinib ko‘r/).first();
  await expect(verdict).toBeVisible({ timeout: 10_000 });
  const shownWrong = /Yana bir bor/.test((await verdict.textContent()) ?? "");
  expect(shownWrong, `Kutilmagan natija: "${info.prompt}" | oracle=${JSON.stringify(info.correct)} | variantlar=${JSON.stringify(info.texts)}`).toBe(wrong);
}

/** Testni oxirigacha yechadi (wrongAt — xato javob beriladigan savol raqamlari, 0 dan). */
export async function playQuiz(page: Page, { wrongAt = [] as number[], max = 25 } = {}) {
  for (let i = 0; i < max; i++) {
    await answerCurrent(page, { wrong: wrongAt.includes(i) });
    const next = page.getByRole("button", { name: /Keyingi savol|Natijalarni ko‘rish/ });
    await expect(next).toBeVisible();
    const last = /Natijalarni/.test((await next.textContent()) ?? "");
    await next.click();
    if (last) return;
  }
  throw new Error("Test tugamadi");
}
