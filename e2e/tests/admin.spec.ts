import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, adminApi, adminContext, expectAccessible, PORTAL, settle } from "./helpers";

// Both journeys change the shared mock store; run them once per project, one after the other.
test.describe.configure({ mode: "serial" });

const open = async (page: Page, path: string) => {
  const response = await page.goto(`${ADMIN}${path}`);
  expect(response?.status(), path).toBe(200);
  await settle(page);
};

test("import with 5 seeded errors → fix → submit → verify → approve and publish → on the portal", async ({
  browser,
}) => {
  // Contributor: upload the demo file, which carries five seeded errors (brief §10).
  const contributor = await adminContext(browser, "u-contributor");
  const page = await contributor.newPage();
  await open(page, "/imports/new");
  const org = page.getByLabel("Organisation", { exact: true });
  const orgCode = await org.locator("option").nth(1).getAttribute("value");
  await org.selectOption(orgCode!);
  const [demo] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download a demo file with errors" }).click(),
  ]);
  const file = (await demo.path())!;
  const csv = (await readFile(file, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(","));
  await page.locator('input[type="file"]').setInputFiles({
    name: "demo.csv",
    mimeType: "text/csv",
    buffer: await readFile(file),
  });
  await page.getByRole("button", { name: "Upload and continue" }).click();
  // The job page, not /imports/new itself (which the pattern would otherwise match mid-upload).
  await page.waitForURL(/\/imports\/(?!new$)[^/]+$/);
  await expectAccessible(page, "import mapping");
  await page.getByRole("button", { name: "Validate" }).click();

  // All five errors listed at row level.
  const problems = page.getByRole("table", { name: "Problems by row" });
  await expect(problems).toBeVisible({ timeout: 30_000 });
  const showErrorsOnly = page.getByRole("checkbox", { name: "Show errors only" });
  if (await showErrorsOnly.isVisible()) await showErrorsOnly.check();
  const errorRows = problems.locator("tbody tr").filter({ hasText: /Error/ });
  await expect(errorRows).toHaveCount(5);
  await expectAccessible(page, "import validation");

  // Fix the two bad values; remove the unknown area, the unknown indicator and the duplicate.
  const fixedRow = 3; // row 3 holds "n/a" in its value cell
  const fixedValue = "77.7";
  for (const row of await errorRows.all()) {
    const number = Number((await row.locator("th").first().textContent())?.replace(/\D/g, ""));
    const value = row.getByLabel("Value", { exact: true });
    const duplicate = /duplicate/i.test((await row.textContent()) ?? "");
    if ((await value.count()) && !duplicate) {
      await value.fill(number === fixedRow ? fixedValue : "12.5");
    } else {
      await row.getByRole("checkbox", { name: `Remove row ${number}` }).check();
    }
  }
  await page.getByRole("button", { name: "Apply fixes" }).click();
  await expect(page.getByText("Fixes applied. No errors left.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Submit for verification" }).click();
  const done = page.getByText(/Submitted as SUB-\d+/);
  await expect(done.first()).toBeVisible();
  const id = (await done.first().textContent())!.match(/SUB-\d+/)![0];
  await contributor.close();

  // Editor verifies, justifying any warnings first.
  const editor = await adminContext(browser, "u-editor");
  const editing = await editor.newPage();
  await open(editing, `/submissions/${id}`);
  await editing.getByRole("button", { name: "Verify" }).click();
  // Either verified straight away, or refused until the warnings are justified.
  const unjustified = editing
    .getByRole("alert")
    .filter({ hasText: "Justify each warning on the Quality tab before verifying." });
  const status = async () =>
    (await adminApi<{ status: string }>(editing, "u-editor", `/submissions/${id}`)).status;
  await expect
    .poll(async () => ((await unjustified.count()) ? "refused" : await status()))
    .toMatch(/^(refused|verified)$/);
  if (await unjustified.count()) {
    await open(editing, `/submissions/${id}?tab=quality`);
    for (const field of await editing.getByLabel(/Why is this expected/).all()) {
      await field.fill("Growth in line with operator reports.");
    }
    await editing.getByRole("button", { name: "Save" }).first().click();
    await expect(editing.getByText(/saved/i).first()).toBeVisible();
    await editing.getByRole("button", { name: "Verify" }).click();
  }
  await expect
    .poll(
      async () =>
        (await adminApi<{ status: string }>(editing, "u-editor", `/submissions/${id}`)).status,
    )
    .toBe("verified");
  await editor.close();

  // An admin who didn't submit it approves and publishes.
  const admin = await adminContext(browser, "u-admin");
  const approving = await admin.newPage();
  await open(approving, `/submissions/${id}`);
  await approving.getByRole("button", { name: "Approve" }).click();
  await expect(approving.getByRole("button", { name: "Publish" })).toBeVisible();
  await approving.getByRole("button", { name: "Publish" }).click();
  await expect
    .poll(
      async () =>
        (await adminApi<{ status: string }>(approving, "u-admin", `/submissions/${id}`)).status,
    )
    .toBe("published");
  await expectAccessible(approving, "published submission");

  // The same admin can't approve a submission they submitted: shown, but refused with the reason.
  const verifiedList = await adminApi<{ items: { id: string; submittedBy: { id: string } }[] }>(
    approving,
    "u-admin",
    "/submissions?status=verified&pageSize=100",
  );
  const own = verifiedList.items.find((item) => item.submittedBy.id === "u-admin");
  expect(own, "a verified submission by u-admin in the seed").toBeTruthy();
  await open(approving, `/submissions/${own!.id}`);
  const approve = approving.getByRole("button", { name: "Approve" });
  await expect(approve).toHaveAttribute("aria-disabled", "true");
  await expect(
    approving.getByText("You submitted this, so another admin must approve it."),
  ).toBeVisible();
  await admin.close();

  // The fixed value is on the portal on its next load.
  const [indicator, area, period] = csv[fixedRow]!;
  const visitor = await browser.newContext({ locale: "en-GB" });
  const portal = await visitor.newPage();
  // The mock tells the portal to revalidate right after publishing; reload until it has.
  await expect
    .poll(
      async () => {
        await portal.goto(`${PORTAL}/en/data/${indicator}?a=${area}&v=table`);
        // Areas are rows and periods are columns: read the period's cell in the first body row.
        const table = portal.getByRole("table").first();
        const headers = (await table.locator("thead th").allTextContents()).map((cell) =>
          cell.trim(),
        );
        const column = headers.indexOf(period!);
        if (column < 0) return "";
        return (
          (await table.locator("tbody tr").first().locator("th, td").nth(column).textContent()) ??
          ""
        );
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    )
    .toContain(fixedValue);
  await visitor.close();
});

test("dashboard with 3 widgets via drag and drop → publish → open on the portal", async ({
  browser,
}, info) => {
  const slug = `e2e-${info.project.name}-${Date.now().toString(36)}`;
  const title = `E2E dashboard ${info.project.name}`;
  const context = await adminContext(browser, "u-editor");
  const page = await context.newPage();
  await open(page, "/dashboards/new");
  await page.getByRole("textbox", { name: /^French/ }).fill(title);
  await page.getByRole("textbox", { name: "English", exact: true }).fill(title);
  await page.getByRole("textbox", { name: "Address" }).fill(slug);
  await page.getByRole("button", { name: "Create and open the builder" }).click();
  await page.waitForURL(`**/dashboards/${slug}`);

  for (const type of ["KPI", "Line chart", "Bar chart"]) {
    await page.getByRole("button", { name: `Add a widget: ${type}` }).click();
  }
  const handles = page.getByRole("button", { name: /^Move .+, position \d$/ });
  await expect(handles).toHaveCount(3);
  const order = async () =>
    (
      await handles.evaluateAll((items) =>
        items.map((item) => item.getAttribute("aria-label") ?? ""),
      )
    ).map((label) => label.replace(/^Move (.+), position \d$/, "$1"));
  expect(await order()).toEqual(["KPI", "Line chart", "Bar chart"]);

  if (info.project.name === "pixel5") {
    // Phones: the stacked widgets put the target off-screen, so use dnd-kit's keyboard sensor
    // (the accessible alternative to dragging). The desktop projects drag with the pointer.
    // dnd-kit measures the layout after picking up, so give it a frame between keys.
    await handles.nth(2).focus();
    for (const key of ["Space", "ArrowUp", "ArrowUp", "Space"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(250);
    }
  } else {
    // Drag the bar chart onto the first place with the pointer.
    const from = (await handles.nth(2).boundingBox())!;
    const to = (await handles.nth(0).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 3 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
    await page.mouse.up();
  }
  await expect.poll(order).toEqual(["Bar chart", "KPI", "Line chart"]);
  await expectAccessible(page, "dashboard builder");

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published. The portal shows it on its next load.")).toBeVisible();
  await context.close();

  const visitor = await browser.newContext({ locale: "en-GB" });
  const portal = await visitor.newPage();
  const response = await portal.goto(`${PORTAL}/fr/dashboards/${slug}`);
  expect(response?.status()).toBe(200);
  await expect(portal.locator("main h1")).toContainText(title);
  // Each widget is a WidgetShell section labelled by its h2.
  await expect(portal.locator("main section[aria-labelledby]:has(> div > h2)")).toHaveCount(3);
  await expectAccessible(portal, "published dashboard on the portal");
  await visitor.close();
});
