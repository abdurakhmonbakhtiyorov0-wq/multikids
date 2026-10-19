import { defineConfig, devices } from "@playwright/test";

// Haqiqiy brauzerda to‘liq stek: embedded PostgreSQL -> backend (4000) -> frontend (production build, 3000).
// Oldin frontend'ni E2E uchun yig‘ing: npm run build (e2e papkasida)
export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: { channel: process.env.E2E_BROWSER === "bundled" ? undefined : "chrome", baseURL: "http://localhost:3100", trace: "retain-on-failure", screenshot: "only-on-failure", locale: "uz-UZ" },
  projects: [
    { name: "desktop", testIgnore: /layout\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "phone", testMatch: /layout\.spec\.ts/, use: { ...devices["Pixel 7"] } },
    { name: "tablet", testMatch: /layout\.spec\.ts/, use: { ...devices["Galaxy Tab S4"] } },
  ],
  webServer: [
    { command: "node backend.mjs", url: "http://localhost:4100/api/health", timeout: 240_000, reuseExistingServer: false },
    { command: "npx next start -p 3100", cwd: "../frontend", env: { NEXT_DIST_DIR: ".next-e2e" }, url: "http://localhost:3100/login", timeout: 120_000, reuseExistingServer: false },
  ],
});
