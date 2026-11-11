import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

type Entry = { type: string; id: string; name: string; title: string; tags?: string[] };

const index = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../apps/storybook/storybook-static/index.json", import.meta.url)),
    "utf8",
  ),
) as { entries: Record<string, Entry> };

const stories = Object.values(index.entries).filter((entry) => entry.type === "story");
const WIDTHS = [360, 768, 1280] as const;

for (const story of stories) {
  // "Mobile" stories already pin a phone viewport, so the wider shots would repeat it.
  const widths = story.name === "Mobile" ? [360] : WIDTHS;
  for (const width of widths) {
    test(`${story.title} / ${story.name} @ ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
      await page.waitForSelector("#storybook-root > *", { state: "attached" });
      // Fonts, lazy chart hydration and the play function settle before the shot.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(400);
      await expect(page).toHaveScreenshot(`${story.id}-${width}.png`, { fullPage: true });
    });
  }
}
