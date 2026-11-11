import { expect, test } from "@playwright/test";
import { expectAccessible, settle } from "./helpers";

test.describe("Lite mode from Save-Data", () => {
  // What a browser with data saving on sends; the server turns Lite on for the first visit.
  test.use({ extraHTTPHeaders: { "Save-Data": "on" } });

  test("map page shows the SVG map only, and never requests MapLibre", async ({ page }) => {
    const maplibre: string[] = [];
    page.on("request", (request) => {
      if (/maplibre/i.test(request.url())) maplibre.push(request.url());
    });
    await page.goto("/en/map?i=ACCESS.INTERNET_USERS");
    await expect(page.locator("html")).toHaveAttribute("data-lite", /.*/);
    await settle(page);
    await expect(page.getByRole("img", { name: /Internet users by Region/ })).toBeVisible();
    await expect(page.locator(".maplibregl-map, canvas")).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Show basemap" })).toHaveCount(0);
    // Interacting with the map still loads nothing from MapLibre.
    const options = page.getByRole("region", { name: "Map options" });
    const toggle = options.getByRole("button", { name: "Map options" });
    if ((await toggle.count()) && (await toggle.getAttribute("aria-expanded")) === "false") {
      await toggle.click();
    }
    await page.getByRole("button", { name: "List view" }).click();
    await settle(page);
    expect(maplibre).toEqual([]);
    await expectAccessible(page, "map in Lite mode");
  });
});

test("offline after one visit: home and the last indicator render with the offline banner", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === "webkit" && process.platform === "win32",
    "Playwright's WebKit on Windows has no service workers",
  );
  const indicator = "/en/data/ACCESS.MOBILE_OWN";
  await page.goto("/en");
  // The worker registers when the page is idle; wait until it controls the page.
  await page.waitForFunction(
    async () => {
      const registration = await navigator.serviceWorker?.getRegistration();
      return Boolean(registration?.active);
    },
    undefined,
    { timeout: 30_000 },
  );
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await page.goto(indicator);
  await settle(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "Mobile phone ownership" }),
  ).toBeVisible();
  // Let the worker finish writing the pages it was sent.
  await page.waitForTimeout(1500);

  await context.setOffline(true);
  for (const [path, heading] of [
    ["/en", null],
    [indicator, "Mobile phone ownership"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByText(/You're offline/).first()).toBeVisible();
    if (heading) await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    else await expect(page.locator("main h1")).toBeVisible();
  }
  await expectAccessible(page, "indicator page offline");
  await context.setOffline(false);
});
