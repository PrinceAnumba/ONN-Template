import { defineConfig } from "@playwright/test";

/**
 * Visual regression of every Storybook story at 360, 768 and 1280 px (brief §10), against the
 * static build (`pnpm build-storybook`). Baselines depend on the OS's font rendering, so they are
 * stored per platform; CI compares against the Linux ones (see README, "Visual baselines").
 */
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./visual",
  outputDir: "./test-results/visual",
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{arg}{ext}",
  timeout: 30_000,
  fullyParallel: true,
  workers: CI ? 2 : 4,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI
    ? [["github"], ["html", { open: "never", outputFolder: "visual-report" }]]
    : [["dot"]],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" },
  },
  use: {
    baseURL: "http://localhost:6006",
    browserName: "chromium",
    reducedMotion: "reduce",
    locale: "en-GB",
    timezoneId: "Africa/Dakar",
  },
  webServer: {
    command: "node visual/serve.mjs",
    url: "http://localhost:6006/index.json",
    reuseExistingServer: !CI,
  },
});
