import { test } from "@playwright/test";
import { loginViaApi } from "./helpers";

// Vizual tekshiruv uchun skrinshotlar (e2e/shots/, Git'ga qo‘shilmaydi): npx playwright test shots-modules --project=desktop
test("modullar skrinshotlari", async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/module-landing.png" });

  for (const [name, profile] of [
    ["middle", { grade: 7, subject: "algebra" }],
    ["senior", { grade: 10, subject: "algebra" }],
    ["special", { grade: 12, subject: "sat-math" }],
  ] as const) {
    await loginViaApi(page, request, profile);
    for (const p of ["/dashboard", "/tests", "/quiz?test=level-1"]) {
      await page.goto(p);
      await page.waitForTimeout(p === "/dashboard" ? 3000 : 1800);
      await page.screenshot({ path: `shots/module-${name}-${p.replace(/[/?=]/g, "_")}.png` });
    }
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
  }
});
