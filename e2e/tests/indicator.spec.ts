import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { expectAccessible, pickOption, settle } from "./helpers";

const INDICATOR = "ACCESS.INTERNET_USERS";

test("home → selector → indicator page; focus and comparison survive a shared URL", async ({
  page,
  browser,
}, info) => {
  await page.goto("/en");
  await expectAccessible(page, "home");

  // Brief §10 journey 1: pick "Internet users" in the hero selector.
  await pickOption(page, "Indicator or dashboard", "Internet users", /^Internet users/);
  await page.getByRole("button", { name: "Explore" }).click();
  await page.waitForURL(`**/en/data/${INDICATOR}`);
  await expect(page.getByRole("heading", { level: 1, name: "Internet users" })).toBeVisible();

  // Chart, table and map tabs.
  const views = page.getByRole("navigation", { name: "View" });
  for (const view of ["Chart", "Table", "Map"]) {
    await expect(views.getByRole("link", { name: view })).toBeVisible();
  }

  // Focus on a region and compare with a peer group, through the selector bar (a sheet on phones).
  const mobile = info.project.name === "pixel5";
  if (mobile) {
    await page.getByRole("button", { name: /Choose data/ }).click();
    await page.getByRole("dialog").waitFor();
  }
  await pickOption(page, "Focus area", "Dakar", /^Dakar$/);
  if (!mobile) await page.waitForURL(/a=SN-01/);
  await pickOption(page, "Comparison", "WAEMU", /Peer group: WAEMU/);
  if (mobile) await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL(/a=SN-01/);
  await page.waitForURL(/c=peer%3AWAEMU|c=peer:WAEMU/);
  await settle(page);
  await expect(page.getByText("Latest value, Dakar")).toBeVisible();
  await expectAccessible(page, "indicator page");

  // The same URL in a fresh context gives the identical view.
  const url = page.url();
  const summary = async (target: typeof page) =>
    (await target.locator("main").getByRole("img").first().getAttribute("aria-label")) ?? "";
  const shown = await summary(page);
  expect(shown).toContain("Dakar");
  const other = await browser.newContext({ locale: "en-GB" });
  const copy = await other.newPage();
  await copy.goto(url);
  await expect(copy.getByText("Latest value, Dakar")).toBeVisible();
  expect(await summary(copy)).toBe(shown);
  expect(await copy.locator("main h1").textContent()).toBe(
    await page.locator("main h1").textContent(),
  );
  await other.close();
});

test("sex breakdown → CSV holds exactly the plotted series", async ({ page }) => {
  await page.goto(`/en/data/${INDICATOR}`);
  await page.getByRole("radio", { name: "Sex" }).click();
  await page.waitForURL(/d=sex/);
  await settle(page);

  // The table the chart is drawn from (visually hidden until "View as table").
  await page.getByRole("button", { name: "View as table" }).first().click();
  const table = page.getByRole("table").first();
  await expect(table).toBeVisible();
  // The server re-renders with the breakdown; wait for it rather than reading the old table.
  await expect(table.locator("thead")).toContainText("Women");
  const header = (await table.locator("thead th").allTextContents()).map((cell) => cell.trim());
  expect(header).toEqual(expect.arrayContaining(["Women", "Men"]));
  const rows = await table
    .locator("tbody tr")
    .evaluateAll((trs) =>
      trs.map((tr) =>
        [...tr.querySelectorAll("th, td")].map((cell) => cell.textContent?.trim() ?? ""),
      ),
    );

  await page.getByRole("button", { name: "Download", exact: true }).first().click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "CSV (plotted data)" }).click(),
  ]);
  const csv = (await readFile((await download.path())!, "utf8")).replace(/^\uFEFF/, "").trim();
  const lines = csv.split(/\r?\n/).map((line) => line.split(","));
  // One header line and one line per plotted period, with the same series as the chart.
  expect(lines[0]).toEqual(expect.arrayContaining(["Women", "Men"]));
  expect(lines.slice(1)).toHaveLength(rows.length);
  expect(lines.slice(1).map((line) => line[0])).toEqual(rows.map((row) => row[0]));
  await expectAccessible(page, "indicator page, sex breakdown");
});

test("locale fr → en → wo keeps path and filters, with no missing messages", async ({ page }) => {
  const missing: string[] = [];
  page.on("console", (message) => {
    if (/MISSING_MESSAGE|missing message/i.test(message.text())) missing.push(message.text());
  });
  await page.goto(`/fr/data/${INDICATOR}?a=SN-02&y=2018-2024`);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  for (const locale of ["en", "wo"]) {
    // On phones the switcher is inside the menu sheet.
    const switcher = page.getByRole("navigation", { name: /Langue|Language|Làkk/ });
    if (!(await switcher.first().isVisible())) {
      await page.getByRole("banner").getByRole("button", { name: /menu/i }).click();
    }
    await switcher.locator(`a[lang=${locale}]`).first().click();
    await page.waitForURL(`**/${locale}/data/${INDICATOR}?**`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const url = new URL(page.url());
    expect(url.searchParams.get("a")).toBe("SN-02");
    expect(url.searchParams.get("y")).toBe("2018-2024");
    // next-intl prints an unknown key as "Namespace.key".
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\b(Indicator|Selector|Chart|Common|Header|Footer|Nav)\.[a-z]\w+/);
    await expectAccessible(page, `indicator page (${locale})`);
  }
  expect(missing).toEqual([]);
});
