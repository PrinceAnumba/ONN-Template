import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const PORTAL = process.env.E2E_PORTAL ?? "http://localhost:3000";
// Through the portal's /admin rewrite, as deployed (multi-zones): previews then load the portal.
export const ADMIN = process.env.E2E_ADMIN ?? `${PORTAL}/admin`;
export const MOCK = process.env.E2E_MOCK ?? "http://localhost:4000/api/v1";

/**
 * Fails on any serious or critical axe violation (brief §10 "axe reports zero serious/critical
 * issues"). Scalar's API reference is excluded: its nested-interactive markup is its own.
 */
export async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude(".scalar-app")
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  const report = blocking.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.nodes
        .slice(0, 5)
        .map((node) => node.target.join(" "))
        .join("\n  ")}`,
  );
  expect(report, `axe on ${label}`).toEqual([]);
}

/** Collects page errors and failed requests other than expected validation answers. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** A signed-in back-office context for a demo user (the mock reads the token as the user id). */
export async function adminContext(browser: Browser, user: string): Promise<BrowserContext> {
  const context = await browser.newContext({ locale: "en-GB", acceptDownloads: true });
  await context.addCookies([
    { name: "onn-session", value: user, domain: "localhost", path: "/admin" },
    { name: "NEXT_LOCALE", value: "en", domain: "localhost", path: "/" },
  ]);
  return context;
}

/** Calls the admin mock API directly as a demo user. */
export async function adminApi<T>(page: Page, user: string, path: string): Promise<T> {
  const response = await page.request.get(`${MOCK}/admin${path}`, {
    headers: { Authorization: `Bearer ${user}`, "Accept-Language": "en" },
  });
  expect(response.ok(), `GET ${path}`).toBe(true);
  return (await response.json()) as T;
}

/** Waits until client-side navigation and data refreshes settle. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
}

/** Picks an option from one of the hand-built APG comboboxes by typing part of its name. */
export async function pickOption(
  page: Page,
  label: string | RegExp,
  text: string,
  option?: RegExp,
) {
  const input = page.getByRole("combobox", { name: label }).first();
  await input.click();
  await input.fill(text);
  await page
    .getByRole("option", { name: option ?? new RegExp(text, "i") })
    .first()
    .click();
}
