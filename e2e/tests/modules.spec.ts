import { test, expect } from "@playwright/test";
import { loginViaApi, playQuiz, uniqueEmail } from "./helpers";

// Modullar: bosh sahifada tanlov, har bir modulning o‘z muhiti (qahramonsiz jiddiy, ilmiy 3D, SAT) va testlar.

test("bosh sahifa: to‘rtta modul; kirgan foydalanuvchiga faqat 'Davom etish'", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(4);
  for (const name of ["Boshlang‘ich", "O‘rta", "Yuqori", "Maxsus"]) await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  await expect(page.getByText("SAT Math", { exact: false }).first()).toBeVisible();

  await loginViaApi(page, request);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Davom etish/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
});

test("o‘rta modul: qahramonsiz jiddiy ko‘rinish, 7-sinf algebra testi boshidan oxirigacha", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("listitem").filter({ hasText: "O‘rta" }).getByRole("link", { name: /Shu modulni tanlash/ }).click();
  await page.waitForURL("**/register?module=middle");
  await expect(page.locator("html")).toHaveAttribute("data-module", "middle");

  await page.getByLabel("Ismingiz").fill("Aziz");
  await page.getByLabel("Email manzil").fill(uniqueEmail());
  await page.getByLabel("Parol", { exact: true }).fill("secret123");
  await page.getByLabel("Parolni tasdiqlang").fill("secret123");
  // 5-sinfdan boshlab ota-ona tasdig‘i yo‘q: galochka o‘rniga oddiy xabar
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByText(/Ro‘yxatdan o‘tish orqali/)).toBeVisible();
  await page.getByRole("button", { name: "Ro‘yxatdan o‘tish" }).click();
  await page.waitForURL("**/onboarding");

  // Qahramon bosqichi yo‘q: darhol sinf (faqat 5–8)
  await expect(page.getByRole("heading", { name: "Qaysi sinfda o‘qiysiz?" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Pandacha/ })).toHaveCount(0);
  await expect(page.locator("main").getByRole("radio")).toHaveCount(4);
  await page.getByRole("radio", { name: /7-sinf/ }).click();
  await page.getByRole("button", { name: "Tasdiqlash" }).click();

  // Fanlar sinfga mos: savollari tayyorlar tanlanadi, qolganlari "Tez orada"
  await expect(page.getByRole("radio", { name: /Tarix/ })).toBeDisabled();
  await expect(page.getByRole("radio", { name: /Fizika/ })).toBeEnabled(); // 7-sinf fizikasi tayyor
  await expect(page.getByRole("radio", { name: /Geografiya/ })).toBeDisabled();
  await expect(page.getByRole("radio", { name: /O‘qish/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /Algebra/ }).click();
  await page.getByRole("button", { name: "Darsni boshlash" }).click();
  await page.waitForURL("**/dashboard");

  await expect(page.locator("html")).toHaveAttribute("data-module", "middle");
  await expect(page.getByText("Salom, Aziz!")).toBeVisible(); // emojisiz
  await expect(page.getByText("Mening qahramonim")).toBeHidden();
  await expect(page.locator("canvas")).toHaveCount(0);
  // Next oldin ochilgan sahifalarni yashirin holda saqlaydi — faqat ko‘rinib turgan sahifani tekshiramiz.
  await expect(page.locator("main:visible")).toHaveCount(1);
  const text = await page.locator("main:visible").innerText();
  expect(text.match(/\p{Extended_Pictographic}/gu), `jiddiy modulda matnda emoji bo‘lmasligi kerak:\n${text}`).toBeNull();

  await page.goto("/quiz?test=level-1");
  await expect(page.getByText(/Savol 1 \/ 10/)).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await playQuiz(page, { wrongAt: [1] });
  await expect(page.getByText("Aniqlik")).toBeVisible();

  // Natijalar: shu sinf fanlari (algebra, geometriya...), boshlang‘ich fanlari yo‘q
  await page.goto("/progress");
  await expect(page.getByText("Algebra").first()).toBeVisible();
  await expect(page.getByText("Geometriya").first()).toBeVisible();
  await expect(page.getByText("O‘qish")).toHaveCount(0);
});

test("yuqori modul: zamonaviy qorong‘i ko‘rinish va atom/DNK 3D sahnasi", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await loginViaApi(page, request, { grade: 10, subject: "algebra" });
  await page.goto("/dashboard");
  await expect(page.locator("html")).toHaveAttribute("data-module", "senior");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("img", { name: "Atom va DNK: ilmiy 3D tasvir" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.waitForTimeout(1200); // sahna bir necha kadr chizilsin
  expect(errors).toEqual([]);
  await expect(page.getByText("10-sinf").first()).toBeVisible();
});

test("maxsus modul (SAT): ikki fan, 'SAT' yorlig‘i va test boshidan oxirigacha", async ({ page, request }) => {
  await loginViaApi(page, request, { grade: 12, subject: "sat-math" });
  await page.goto("/tests");
  await expect(page.locator("html")).toHaveAttribute("data-module", "special");
  await expect(page.getByRole("heading", { name: /SAT Math · SAT/ })).toBeVisible();
  await page.goto("/quiz?test=level-1");
  await expect(page.getByText(/Savol 1 \/ 10/)).toBeVisible();
  await playQuiz(page);
  await expect(page.getByText("Aniqlik")).toBeVisible();

  await page.goto("/progress");
  await expect(page.getByText("SAT Math").first()).toBeVisible();
  await expect(page.getByText("SAT Reading & Writing").first()).toBeVisible();
  await expect(page.getByText("Algebra", { exact: true })).toHaveCount(0);
});

test("ro‘yxatdan o‘tishdan oldin modul tanlanmagan bo‘lsa, onboarding modulni so‘raydi", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Ismingiz").fill("Dilnoza");
  await page.getByLabel("Email manzil").fill(uniqueEmail());
  await page.getByLabel("Parol", { exact: true }).fill("secret123");
  await page.getByLabel("Parolni tasdiqlang").fill("secret123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Ro‘yxatdan o‘tish" }).click();
  await page.waitForURL("**/onboarding");
  await expect(page.getByRole("heading", { name: "O‘zingizga mos modulni tanlang" })).toBeVisible();
  await page.getByRole("radio", { name: /Maxsus/ }).click();
  await expect(page.getByRole("heading", { name: "SAT tayyorgarlikni boshlaymiz" })).toBeVisible();
  await page.getByRole("radio", { name: /SAT/ }).click();
  await page.getByRole("button", { name: "Tasdiqlash" }).click();
  await page.getByRole("radio", { name: /SAT Reading/ }).click();
  await page.getByRole("button", { name: "Darsni boshlash" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.locator("html")).toHaveAttribute("data-module", "special");
});
