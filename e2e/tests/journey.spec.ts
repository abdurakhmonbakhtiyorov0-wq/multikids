import { test, expect } from "@playwright/test";
import { API, loginViaApi, playQuiz, answerCurrent, uniqueEmail } from "./helpers";

test("to‘liq yo‘l: ro‘yxatdan o‘tish → qahramon/sinf/fan → test → natija → saqlanish → do‘kon → ota-ona", async ({ page }) => {
  const email = uniqueEmail();
  // Bosh sahifa: to‘rtta modul; boshlang‘ichni tanlaymiz
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(4);
  await page.getByRole("listitem").filter({ hasText: "Boshlang‘ich" }).getByRole("link", { name: /Shu modulni tanlash/ }).click();
  await page.waitForURL("**/register?module=junior");
  await expect(page.getByText(/Tanlangan modul:/)).toContainText("Boshlang‘ich");
  await page.getByLabel("Ismingiz").fill("Aziz");
  await page.getByLabel("Email manzil").fill(email);
  await page.getByLabel("Parol", { exact: true }).fill("secret123");
  await page.getByLabel("Parolni tasdiqlang").fill("secret123");

  // Rozilik belgilanmasa — ro‘yxatdan o‘tib bo‘lmaydi
  await page.getByRole("button", { name: "Ro‘yxatdan o‘tish" }).click();
  await expect(page.getByText("Davom etish uchun ota-ona roziligi kerak")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Ro‘yxatdan o‘tish" }).click();
  await page.waitForURL("**/onboarding");

  await page.getByRole("radio", { name: /Pandacha/ }).click();
  await page.getByRole("button", { name: "Shu qahramonni tanlayman" }).click();
  await page.getByRole("button", { name: /Davom etish/ }).click();
  await page.getByRole("radio", { name: /3-sinf/ }).click();
  await page.getByRole("button", { name: "Tasdiqlash" }).click();
  await page.getByRole("radio", { name: /Matematika/ }).click();
  await page.getByRole("button", { name: "Darsni boshlash" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByText("Salom, Aziz!")).toBeVisible();

  // Testlar ro‘yxati: 5 bosqich, faqat birinchisi ochiq
  await page.getByRole("link", { name: /Testlarni ko‘rish/ }).click();
  await expect(page.getByRole("heading", { name: "5 bosqichli testlar" })).toBeVisible();
  await expect(page.getByText("🔒 Oldingi bosqichni kamida 60% bilan yakunlang").first()).toBeVisible();
  await page.getByRole("link", { name: /Boshlash/ }).first().click();

  await expect(page.getByText(/Savol 1 \/ 10/)).toBeVisible();
  await playQuiz(page);
  await expect(page.getByText("Aniqlik")).toBeVisible();
  await expect(page.getByText("1-bosqich · Boshlang‘ich").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Keyingi bosqich ▶" })).toBeVisible();

  // Saytni qayta yuklagach progress saqlanadi
  await page.goto("/dashboard");
  await page.reload();
  await expect(page.getByText(/⭐ 70 ball/)).toBeVisible(); // 10 × 5 + "Birinchi qadam" (20)

  // Ota-ona bo‘limi: PIN, statistika
  await page.goto("/parent");
  await page.getByLabel("Yangi PIN-kod").fill("1234");
  await page.getByLabel("Hisob paroli (tasdiqlash uchun)").fill("secret123");
  await page.getByRole("button", { name: "PIN o‘rnatish va kirish" }).click();
  await expect(page.getByRole("heading", { name: /Ota-onalar kabineti/ })).toBeVisible();
  await expect(page.getByText("Topshirilgan testlar", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "1-bosqich · Boshlang‘ich" })).toBeVisible();
  await expect(page.getByText("Ma’lumot kam: kamida 3 ta test kerak")).toBeVisible();
});

test("test o‘rtasida sahifa yangilansa, shu savoldan davom etadi", async ({ page, request }) => {
  await loginViaApi(page, request);
  await page.goto("/quiz?test=level-1");
  await expect(page.getByText(/Savol 1 \/ 10/)).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await answerCurrent(page);
    await page.getByRole("button", { name: /Keyingi savol/ }).click();
  }
  await expect(page.getByText(/Savol 4 \/ 10/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Savol 4 \/ 10/)).toBeVisible();
  await expect(page.getByText("7 ta savol qoldi")).toBeVisible();
});

test("xato kirish: noto‘g‘ri parol tushunarli xabar beradi", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email manzil").fill("nobody@example.com");
  await page.getByLabel("Parol", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Kirish" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email yoki parol noto‘g‘ri" })).toBeVisible();
});

test("internet uzilsa javob 'saqlandi' deb ko‘rsatilmaydi, aloqa tiklangach o‘zi yuboriladi", async ({ page, request, context }) => {
  await loginViaApi(page, request);
  await page.goto("/quiz?test=level-1");
  await expect(page.getByText(/Savol 1 \/ 10/)).toBeVisible();
  await context.setOffline(true);
  await page.locator("main button").filter({ hasText: /^A/ }).first().click();
  await expect(page.getByText(/Internet yo‘q — javobingiz hali yuborilmadi/)).toBeVisible();
  await expect(page.getByText(/To‘g‘ri javob!|Yana bir bor urinib ko‘r/)).toBeHidden();
  await context.setOffline(false);
  await expect(page.getByText(/To‘g‘ri javob!|Yana bir bor urinib ko‘r/)).toBeVisible({ timeout: 30_000 });
  // server tomonda aynan bitta javob saqlangan
  await page.reload();
  await expect(page.getByText(/Savol 2 \/ 10/)).toBeVisible();
});

test("qorong‘i mavzu va katta shrift saqlanadi", async ({ page, request }) => {
  await loginViaApi(page, request);
  await page.goto("/profile");
  await page.getByRole("radio", { name: /Qorong‘i/ }).click();
  await page.getByRole("radio", { name: /Juda katta/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-size", "xlarge");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(11, 20, 38)");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const fontSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  expect(parseFloat(fontSize)).toBeGreaterThan(20);
});

test("PWA: manifest, service worker, offline sahifa va API keshlanmaydi", async ({ page, context }) => {
  await page.goto("/login");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toContain("512x512");
  await expect(page.locator("link[rel='manifest']")).toHaveCount(1);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.goto("/register");
  await page.goto("/login");

  await context.setOffline(true);
  await page.goto("/login");
  await expect(page.getByText("Qaytganingdan xursandmiz!")).toBeVisible(); // oldin ochilgan sahifa keshdan
  await page.goto("/tasks"); // hech ochilmagan sahifa
  await expect(page.getByRole("heading", { name: "Internet yo‘q" })).toBeVisible();
  await context.setOffline(false);

  const cached = await page.evaluate(async () => {
    const out: string[] = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url);
    return out;
  });
  expect(cached.length).toBeGreaterThan(0);
  expect(cached.filter((u) => u.includes("/api/") || u.includes(":4100"))).toEqual([]);
});

test("ota-ona bo‘limi PIN-kodsiz yopiq", async ({ page, request }) => {
  const { token } = await loginViaApi(page, request);
  const r = await request.get(`${API}/api/parent/overview`, { headers: { Authorization: `Bearer ${token}` } });
  expect(r.status()).toBe(403);
  await page.goto("/parent");
  await expect(page.getByRole("heading", { name: /Ota-onalar uchun bo‘lim/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Ota-onalar kabineti/ })).toBeHidden();
});

test("aralash test va imtihondan tugamasdan chiqib bo‘lmaydi; oddiy bosqichda menyu bor", async ({ page, request }) => {
  await loginViaApi(page, request);
  const nav = page.getByRole("link", { name: "Testlar", exact: true });

  // Oddiy bosqichli test: menyu ko‘rinadi
  await page.goto("/quiz?test=level-1");
  await expect(page.getByText(/Savol 1 \/ 10/)).toBeVisible();
  await expect(nav.first()).toBeVisible();

  for (const [test, banner] of [["mixed", /Aralash test tugamaguncha chiqib bo‘lmaydi/], ["exam", /Imtihon tugamaguncha chiqib bo‘lmaydi/]] as const) {
    await page.goto("/tests");
    await page.goto(`/quiz?test=${test}`);
    await expect(page.getByText(/Savol 1 \/ 20/)).toBeVisible();
    await expect(page.getByText(banner)).toBeVisible();
    // Menyu, logotip havolasi va chiqish tugmasi yo‘q
    await expect(nav).toHaveCount(0);
    await expect(page.getByRole("link", { name: /MultiKids/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Chiqish" })).toHaveCount(0);
    // "Orqaga" tugmasi testda qoldiradi
    await page.goBack();
    await page.waitForTimeout(500);
    expect(page.url()).toContain(`/quiz?test=${test}`);
    await expect(page.getByText(/Savol 1 \/ 20/)).toBeVisible();
  }
});

const GRADE_WARNING =/barcha yutuqlar shu sinfda saqlanadi.*noldan boshlanadi/;

test("boshlang‘ich sinfdan o‘tish: ogohlantirish va ota-ona PIN-kodi", async ({ page, request }) => {
  const { token } = await loginViaApi(page, request); // 3-sinf
  const auth = { Authorization: `Bearer ${token}` };
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sinfni o‘zgartirish" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(GRADE_WARNING)).toBeVisible();
  await expect(dialog.getByText(/ota-ona PIN-kodi kerak/)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Ota-ona bo‘limiga o‘tish" })).toBeVisible(); // PIN hali yo‘q
  await dialog.getByRole("radio", { name: /4-sinf/ }).click();
  await expect(dialog.getByRole("button", { name: "Sinfga o‘tish" })).toBeDisabled(); // PIN kiritilmaguncha

  // Server ham PIN-kodsiz o‘tkazmaydi
  expect((await request.post(`${API}/api/me/grade`, { data: { grade: 4 }, headers: auth })).status()).toBe(403);

  await request.post(`${API}/api/parent/pin`, { data: { pin: "4321", password: "secret123" }, headers: auth });
  await page.reload();
  await page.getByRole("button", { name: "Sinfni o‘zgartirish" }).click();
  await page.getByLabel("PIN-kod").fill("4321");
  await page.getByRole("button", { name: /Ota-ona sifatida ochish/ }).click();
  await page.getByRole("dialog").getByRole("radio", { name: /4-sinf/ }).click();
  await page.getByRole("button", { name: "Sinfga o‘tish" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByText("4-sinf").first()).toBeVisible();
});

test("5-sinfdan boshlab sinf erkin almashadi; yutuqlar o‘z sinfida qoladi, yangi sinf noldan, qaytsa eskisi qaytadi", async ({ page, request }) => {
  await loginViaApi(page, request, { grade: 7, subject: "algebra" });
  await page.goto("/quiz?test=level-1");
  await expect(page.getByText(/Savol 1 \/ 10/)).toBeVisible();
  await playQuiz(page);
  await expect(page.getByText("Aniqlik")).toBeVisible();

  const points = async () => {
    await page.goto("/dashboard");
    await expect(page.locator("main:visible")).toContainText("Jami ball");
    const card = page.locator("main:visible").getByText("Jami ball").locator("..");
    await expect(card).not.toContainText("–"); // natijalar yuklangunicha procherk ko‘rinadi
    return (await card.innerText()).split("\n")[0];
  };
  const at7 = await points();
  expect(Number(at7)).toBeGreaterThan(0);

  // 8-sinfga o‘tish: ota-ona PIN-kodi so‘ralmaydi, ogohlantirish ko‘rsatiladi
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sinfni o‘zgartirish" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(GRADE_WARNING)).toBeVisible();
  await expect(dialog.getByLabel("PIN-kod")).toHaveCount(0);
  await dialog.getByRole("radio", { name: /8-sinf/ }).click();
  await dialog.getByRole("button", { name: "Sinfga o‘tish" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByText("8-sinf").first()).toBeVisible();
  expect(await points()).toBe("0"); // yangi sinf noldan

  // 7-sinfga qaytish: yutuqlar o‘z joyida
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sinfni o‘zgartirish" }).click();
  await page.getByRole("dialog").getByRole("radio", { name: /7-sinf/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sinfga o‘tish" }).click();
  await page.waitForURL("**/dashboard");
  expect(await points()).toBe(at7);
});

test("til almashtirish: ruscha va o‘zbekcha kirill, tanlov saqlanadi, aralash til yo‘q", async ({ page, request }) => {
  await loginViaApi(page, request);
  await page.goto("/dashboard");
  await expect(page.getByText("Salom, Aziz!")).toBeVisible();

  await page.getByRole("radio", { name: "RU", exact: true }).first().click();
  await expect(page.getByText("Привет, Aziz!")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByText("Salom, Aziz!")).toBeHidden();
  await expect(page.getByText("Чему научимся сегодня?")).toBeVisible();

  await page.goto("/tests");
  await expect(page.getByRole("heading", { name: "Тесты из 5 уровней" })).toBeVisible();
  await expect(page.getByText("Уровень 1 · Начальный")).toBeVisible();

  // Til qayta yuklangandan keyin ham saqlanadi
  await page.reload();
  await expect(page.getByRole("heading", { name: "Тесты из 5 уровней" })).toBeVisible();

  await page.getByRole("radio", { name: "ЎЗ", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "5 босқичли тестлар" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "uz-Cyrl");

  await page.getByRole("radio", { name: "UZ", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "5 bosqichli testlar" })).toBeVisible();
});

test("kirill rejimida savol matni ham o‘giriladi (o‘zbek tilidagi fan)", async ({ page, request }) => {
  await loginViaApi(page, request, { grade: 3, subject: "native-language", mascot: "pandacha" });
  await page.addInitScript(() => localStorage.setItem("multikids-locale", "uz-cyrl"));
  await page.goto("/quiz?test=level-1");
  const prompt = (await page.locator("main h1").first().textContent()) ?? "";
  expect(prompt).toMatch(/[А-Яа-яЎўҚқҒғҲҳ]/);
  expect(prompt).not.toMatch(/\b(qaysi|so‘z|harf)\b/i);
});
