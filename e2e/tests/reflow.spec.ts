import { expect, test, type Page } from "@playwright/test";
import { ADMIN, adminContext } from "./helpers";

// Brief §9: no horizontal scroll at 320px. Tables and charts scroll inside their own region.
test.use({ viewport: { width: 320, height: 640 } });

const PORTAL_PAGES = [
  "/en",
  "/en/data",
  "/en/data/ACCESS.INTERNET_USERS",
  "/en/data/ACCESS.INTERNET_USERS?v=table",
  "/en/map?i=ACCESS.INTERNET_USERS",
  "/en/dashboards/public",
  "/en/benchmark",
  "/en/query?i=ACCESS.INTERNET_USERS",
  "/en/catalogue",
  "/en/publications",
  "/en/news",
  "/en/open-data",
  "/en/developers",
  "/en/feedback",
  "/en/about",
];

const ADMIN_PAGES = [
  "/",
  "/submissions",
  "/submissions/SUB-0005",
  "/calendar",
  "/imports",
  "/imports/new",
  "/entry",
  "/connectors",
  "/quality",
  "/indicators",
  "/dashboards",
  "/dashboards/public",
  "/publications",
  "/reports",
  "/news",
  "/pages",
  "/alerts",
  "/newsletter",
  "/users",
  "/organisations",
  "/feedback",
  "/audit",
  "/settings",
];

async function overflow(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const culprits: string[] = [];
    for (const element of document.querySelectorAll("body *")) {
      const box = element.getBoundingClientRect();
      if (box.right <= width + 1 || box.width === 0) continue;
      // Content clipped by a scroller (or a fixed layer) is fine.
      let clipped = false;
      for (
        let node = element.parentElement;
        node && node !== document.body;
        node = node.parentElement
      ) {
        const style = getComputedStyle(node);
        if (style.overflowX !== "visible" || style.position === "fixed") {
          clipped = node.getBoundingClientRect().right <= width + 1;
          break;
        }
      }
      if (!clipped) {
        culprits.push(`${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`);
      }
    }
    return { scroll: document.documentElement.scrollWidth - width, culprits: culprits.slice(0, 5) };
  });
}

test.describe("reflow at 320px", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "layout check runs once");

  test("portal pages", async ({ page }) => {
    const failures: string[] = [];
    for (const path of PORTAL_PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const result = await overflow(page);
      if (result.scroll > 0)
        failures.push(`${path}: +${result.scroll}px ${result.culprits.join(", ")}`);
    }
    expect(failures).toEqual([]);
  });

  test("admin pages", async ({ browser }) => {
    const context = await adminContext(browser, "u-super");
    const page = await context.newPage();
    await page.setViewportSize({ width: 320, height: 640 });
    const failures: string[] = [];
    for (const path of ADMIN_PAGES) {
      await page.goto(`${ADMIN}${path}`);
      await page.waitForLoadState("networkidle");
      const result = await overflow(page);
      if (result.scroll > 0)
        failures.push(`${path}: +${result.scroll}px ${result.culprits.join(", ")}`);
    }
    await context.close();
    expect(failures).toEqual([]);
  });
});
