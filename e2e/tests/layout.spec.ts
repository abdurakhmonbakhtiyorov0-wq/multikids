import { test, expect, type Page } from "@playwright/test";
import { loginViaApi } from "./helpers";

// Telefon va planshetda: gorizontal skroll yo‘q, sahifalar xatosiz ochiladi, tugmalar barmoq uchun yetarli.
const PUBLIC = ["/", "/login", "/register", "/forgot", "/privacy", "/offline"];
const AUTHED = ["/dashboard", "/tests", "/tasks", "/profile", "/progress", "/parent"];

async function checkPage(page: Page, path: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${path}: gorizontal skroll (${overflow}px)`).toBeLessThanOrEqual(1);
  expect(errors, `${path}: JavaScript xatolari`).toEqual([]);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ h: Math.round(el.getBoundingClientRect().height), t: (el.textContent ?? "").trim().slice(0, 20) }))
      .filter((x) => x.h > 0 && x.h < 40),
  );
  expect(small, `${path}: juda kichik tugmalar`).toEqual([]);
}

for (const path of PUBLIC) test(`ochiq sahifa ${path}`, async ({ page }) => checkPage(page, path));

test("kirgan foydalanuvchi sahifalari", async ({ page, request }) => {
  await loginViaApi(page, request);
  for (const path of AUTHED) await checkPage(page, path);
});

// O‘rta, yuqori va maxsus modullarning sahifalari ham telefon/planshetda sig‘adi va xatosiz ochiladi.
for (const [label, profile] of [["o‘rta", { grade: 7, subject: "algebra" }], ["yuqori", { grade: 10, subject: "algebra" }], ["maxsus", { grade: 12, subject: "sat-math" }]] as const) {
  test(`${label} modul sahifalari`, async ({ page, request }) => {
    await loginViaApi(page, request, profile);
    for (const path of AUTHED) await checkPage(page, path);
  });
}
