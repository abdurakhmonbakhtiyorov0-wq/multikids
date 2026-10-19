import { test } from "@playwright/test";
import { loginViaApi } from "./helpers";

// Vizual tekshiruv uchun skrinshotlar (e2e/shots/, Git'ga qo‘shilmaydi): npx playwright test shots --project=desktop
test("skrinshotlar", async ({ page, request }) => {
  await loginViaApi(page, request);
  const pages = ["/dashboard", "/tests", "/shop", "/quiz?test=level-1", "/parent"];
  for (const dark of [false, true]) {
    await page.addInitScript((d) => localStorage.setItem("multikids-appearance", JSON.stringify({ theme: d ? "dark" : "light", size: "normal" })), dark);
    for (const p of pages) {
      await page.goto(p);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `shots/${p.replace(/[/?=]/g, "_")}${dark ? "-dark" : ""}.png`, fullPage: false });
    }
  }
});
