import { expect, test } from "@playwright/test";
import { expectAccessible, settle } from "./helpers";

test.describe("map on a 360px phone", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("department level → play years → tap a department → sheet peek, drag to half → set as focus", async ({
    page,
  }) => {
    await page.goto("/en/map?i=ACCESS.INTERNET_USERS");
    const options = page.getByRole("region", { name: "Map options" });
    // On phones the options start folded behind a button.
    const toggle = options.getByRole("button", { name: "Map options" });
    if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();

    await options.getByRole("radio", { name: "Department" }).click();
    await page.waitForURL(/l=adm2/);
    await settle(page);
    await expect(options.getByText(/Department/).first()).toBeVisible();

    // Play runs through the years and stops on the last one.
    const status = options.locator("p.text-muted-foreground").first();
    await options.getByRole("button", { name: "Play" }).click();
    await expect(options.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(options.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 30_000 });
    const lastYear = (await status.textContent())?.match(/\d{4}/)?.[0];
    expect(lastYear).toBeTruthy();
    await toggle.click();

    // Tap a department: the panel opens as a bottom sheet at its peek height.
    const map = page.getByRole("img", { name: /by Department/ });
    await map.scrollIntoViewIfNeeded();
    const shape = map.locator("path[d]").nth(5);
    await shape.tap({ force: true }).catch(() => shape.click({ force: true }));
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect.poll(async () => (await sheet.boundingBox())?.height ?? 0).toBeLessThan(140);

    // Drag the handle up: it snaps to half the viewport.
    const handle = sheet.getByRole("button", { name: "Resize the panel" });
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let step = 1; step <= 10; step++) await page.mouse.move(x, y - step * 30);
    await page.mouse.up();
    await expect
      .poll(async () => (await sheet.boundingBox())?.height ?? 0)
      .toBeGreaterThan(740 * 0.4);
    await expect.poll(async () => (await sheet.boundingBox())?.height ?? 0).toBeLessThan(740 * 0.6);
    await expectAccessible(page, "map with the area sheet");

    const area = (await sheet.getByRole("heading").first().textContent())?.trim();
    await sheet
      .getByRole("link", { name: "Set as focus" })
      .or(sheet.getByRole("button", { name: "Set as focus" }))
      .click();
    await expect.poll(() => new URL(page.url()).searchParams.get("a")).toMatch(/^SN-/);
    expect(area).toBeTruthy();
  });
});

test("dashboard → Present → keyboard and swipe → Esc returns to the same scroll position", async ({
  page,
}) => {
  await page.goto("/en/dashboards/public");
  await settle(page);
  await expectAccessible(page, "dashboard");
  const present = page.getByRole("button", { name: "Present" });
  await present.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 40));
  const before = await page.evaluate(() => window.scrollY);

  await present.click();
  const dialog = page.getByRole("dialog", { name: /Presentation/ });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/p=1/);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/p=2/);
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/p=1/);

  // Swipe left to go forward.
  const box = (await dialog.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.75, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, y, { steps: 8 });
  await page.mouse.up();
  await expect(page).toHaveURL(/p=2/);
  await expectAccessible(page, "presentation");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/p=/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
  await expect(present).toBeFocused();
});

test("query → 3 indicators, 2 areas, 2018–2025 → preview count matches the copied API URL", async ({
  page,
  browserName,
  context,
}) => {
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  await page.goto("/en/query");
  const indicators = page.getByRole("group", { name: "Indicators" });
  for (const name of ["Internet users", "Mobile phone ownership", "Smartphone use"]) {
    await indicators.getByRole("checkbox", { name, exact: true }).check();
  }

  const step = (title: string) =>
    page.getByRole("button", { name: new RegExp(`^(Step \\d+\\s*)?${title}`) }).first();
  const areaBox = (name: string) => page.getByRole("checkbox", { name, exact: true });
  if (!(await areaBox("Dakar").isVisible())) await step("Areas").click();
  await areaBox("Dakar").check();
  await areaBox("Thiès").check();

  if (!(await page.getByRole("slider", { name: "From" }).isVisible())) await step("Years").click();
  const setYear = async (thumb: string, year: number) => {
    const slider = page.getByRole("slider", { name: thumb });
    await slider.focus();
    for (let guard = 0; guard < 40; guard++) {
      const now = Number(await slider.getAttribute("aria-valuenow"));
      if (now === year) return;
      await page.keyboard.press(now < year ? "ArrowRight" : "ArrowLeft");
    }
    throw new Error(`${thumb} never reached ${year}`);
  };
  await setYear("From", 2018);
  await setYear("To", 2025);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL(/y=2018-2025/);
  await settle(page);

  const count = page.getByText(/^\d[\d,\s ]* rows?$/).first();
  await expect(count).toBeVisible();
  const rows = Number((await count.textContent())!.replace(/\D/g, ""));
  expect(rows).toBeGreaterThan(0);

  let apiUrl: string;
  if (browserName === "chromium") {
    await page.getByRole("button", { name: "Copy the API URL" }).click();
    apiUrl = await page.evaluate(() => navigator.clipboard.readText());
  } else {
    apiUrl = (await page.locator("code").first().textContent())!.trim();
  }
  expect(apiUrl).toMatch(/^https?:\/\//);
  const response = await page.request.get(apiUrl);
  expect(response.ok()).toBe(true);
  // The URL asks for the download format the page shows (CSV by default) or JSON.
  const text = (await response.text()).replace(/^\uFEFF/, "").trim();
  let total: number;
  if (text.startsWith("{") || text.startsWith("[")) {
    const json = JSON.parse(text) as { items?: unknown[]; meta?: { total: number } } | unknown[];
    total = Array.isArray(json) ? json.length : (json.meta?.total ?? json.items?.length ?? 0);
  } else {
    total = text.split(/\r?\n/).length - 1;
  }
  expect(total).toBe(rows);
  await expectAccessible(page, "query with a preview");
});
