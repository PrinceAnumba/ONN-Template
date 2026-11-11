import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end journeys from brief §10, against production builds (`pnpm build` first): the
 * service worker, Lite mode and bundle splitting only behave as shipped in a build. The mock
 * server is stateful and shared by every test, so tests never rely on exact counts it holds.
 */
const CI = Boolean(process.env.CI);
const PORTAL = process.env.E2E_PORTAL ?? "http://localhost:3000";
const env = { MOCK_LATENCY: "0", NEXT_TELEMETRY_DISABLED: "1" };

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: CI ? 2 : 3,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: PORTAL,
    locale: "en-GB",
    timezoneId: "Africa/Dakar",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "pixel5", use: { ...devices["Pixel 5"] } },
  ],
  webServer: [
    {
      command: "pnpm --filter @onn/mocks start",
      url: "http://localhost:4000/api/v1/pillars",
      env,
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @onn/portal start",
      url: `${PORTAL}/en`,
      env,
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @onn/admin start",
      url: "http://localhost:3001/admin/login",
      env,
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
