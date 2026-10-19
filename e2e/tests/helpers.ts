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
};

let counter = 0;
export const uniqueEmail = (p = "e2e") => `${p}${Date.now()}${++counter}@example.com`;

/** Akkaunt yaratadi (API orqali, tezroq) va sahifani shu akkauntda ochilgan holatga keltiradi. */
export async function loginViaApi(page: Page, request: APIRequestContext, profile = { grade: 3, subject: "mathematics", mascot: "pandacha" }) {
  const email = uniqueEmail();
  const r = await request.post(`${API}/api/auth/register`, { data: { name: "Aziz", email, password: "secret123", consent: true } });
  expect(r.ok()).toBeTruthy();
  const { token } = await r.json();
  await request.patch(`${API}/api/me`, { data: profile, headers: { Authorization: `Bearer ${token}` } });
  await page.addInitScript(([k, t]) => localStorage.setItem(k, t), [TOKEN_KEY, token]);
  return { email, token };
}

/** Test sahifasi sarlavhasidan ("🔢 Matematika · 3-sinf · ...") sinf va fan ID sini o‘qiydi. */
async function quizContext(page: Page) {
  const line = (await page.locator("main").getByText(/-sinf ·/).first().textContent()) ?? "";
  const grade = Number(/(\d)-sinf/.exec(line)?.[1] ?? 0);
  const title = Object.keys(SUBJECT_IDS).find((t) => line.includes(t));
  return { grade, subject: title ? SUBJECT_IDS[title] : "mathematics" };
}

/** Ko‘rinib turgan savolning to‘g‘ri javob matnini oracle'dan oladi va shu variantni (yoki ataylab xatosini) bosadi. */
export async function answerCurrent(page: Page, { wrong = false } = {}) {
  const h1 = page.locator("main h1").first();
  await expect(h1).toBeVisible();
  // Savol almashganda animatsiya paytida eski sarlavha va yangi variantlar bir lahza aralashib ko‘rinishi mumkin:
  // sarlavha va variantlar o‘zaro mos kelgunicha (oracle tasdiqlaguncha) qayta o‘qiymiz.
  await expect(async () => {
    const prompt = ((await h1.textContent()) ?? "").trim();
    const img = await page.locator("main img[src^='/questions/']").first().getAttribute("src", { timeout: 300 }).catch(() => null);
    const { grade, subject } = await quizContext(page);
    const query = new URLSearchParams({ prompt, grade: String(grade), subject, ...(img ? { img } : {}) });
    const { correct } = (await (await fetch(`${ORACLE}/answer?${query}`)).json()) as { correct: string[] };
    const options = page.locator("main button").filter({ hasText: /^[A-D]/ });
    const count = await options.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) texts.push(((await options.nth(i).textContent()) ?? "").trim().replace(/^[A-D]s*/, ""));
    const rightIdx = texts.findIndex((t) => correct.includes(t));
    expect(rightIdx, `to‘g‘ri variant topilmadi: ${prompt} :: ${correct} / ${texts}`).toBeGreaterThanOrEqual(0);
    await options.nth(wrong ? (rightIdx + 1) % count : rightIdx).click({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
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
