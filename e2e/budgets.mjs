// Performance budgets from brief §9, measured as downloaded (gzipped) bytes in Chromium on the
// target viewport (360 × 640), against production builds and the mock server.
//
// Spec decisions applied (CLAUDE.md "Spec decisions"):
// - First-load JS is measured until the page is usable. ECharts runtimes load near the viewport
//   after the server SVG is on screen, so chunks containing zrender are counted separately.
// - MapLibre loads only behind "Show basemap" (features.basemap), so the map budget is checked
//   after the interactions a visitor makes without it: opening an area panel and the list view.
//
// Usage: node budgets.mjs [--json out.json]. Exits 1 if any budget is over.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const PORTAL = process.env.E2E_PORTAL ?? "http://localhost:3000";
const COUNTRY = process.env.NEXT_PUBLIC_COUNTRY || "SEN";
const KB = 1000;

/** Each page and what is enforced on it. `null` limits are reported only. */
const PAGES = [
  { name: "home", path: "/en", js: 170, transfer: 900, fonts: { files: 2, kb: 90 } },
  { name: "indicator", path: "/en/data/ACCESS.INTERNET_USERS", js: 230 },
  { name: "data profile", path: "/en/data", js: null },
  {
    name: "map (after interaction)",
    path: "/en/map?i=ACCESS.INTERNET_USERS",
    js: 320,
    interact: async (page) => {
      await page
        .getByRole("img", { name: /by Region/ })
        .locator("path[d]")
        .nth(3)
        .click({ force: true });
      await page.getByRole("dialog").or(page.getByRole("complementary")).first().waitFor();
      await page.keyboard.press("Escape");
      // On phones the options (and the list view button) start folded.
      const options = page.getByRole("region", { name: "Map options" });
      const toggle = options.getByRole("button", { name: "Map options" });
      if ((await toggle.count()) && (await toggle.getAttribute("aria-expanded")) === "false") {
        await toggle.click();
      }
      await page.getByRole("button", { name: "List view" }).click();
    },
  },
  { name: "dashboard", path: "/en/dashboards/public", js: null },
];

const results = [];
const failures = [];
const check = (label, value, limit, unit = "KB") => {
  const over = limit !== null && value > limit;
  results.push({ label, value, limit, unit, over });
  if (over) failures.push(label);
};

const browser = await chromium.launch();
for (const spec of PAGES) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-GB",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  const requests = new Map();
  cdp.on("Network.responseReceived", ({ requestId, type, response }) => {
    requests.set(requestId, { type, url: response.url, bytes: 0 });
  });
  cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
    const request = requests.get(requestId);
    if (request) request.bytes = encodedDataLength;
  });

  const response = await page.goto(`${PORTAL}${spec.path}`, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error(`${spec.path} answered ${response?.status()}`);
  await page.waitForTimeout(1500);
  if (spec.interact) {
    await spec.interact(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
  }

  let js = 0;
  let deferred = 0;
  let transfer = 0;
  const fonts = [];
  for (const [requestId, request] of requests) {
    transfer += request.bytes;
    if (request.type === "Font") fonts.push(request);
    if (request.type !== "Script") continue;
    let body = "";
    try {
      body = (await cdp.send("Network.getResponseBody", { requestId })).body;
    } catch {
      // A body the browser dropped can't be inspected; count it as first-load JS.
    }
    if (/zrender|maplibre/i.test(body)) deferred += request.bytes;
    else js += request.bytes;
  }
  const kb = (bytes) => Math.round(bytes / KB);
  check(`${spec.name}: JS`, kb(js), spec.js);
  if (deferred)
    check(`${spec.name}: chart/map runtime loaded near the viewport`, kb(deferred), null);
  if (spec.transfer !== undefined)
    check(`${spec.name}: total transfer`, kb(transfer), spec.transfer);
  if (spec.fonts) {
    check(`${spec.name}: font files`, fonts.length, spec.fonts.files, "files");
    check(
      `${spec.name}: font bytes`,
      kb(fonts.reduce((sum, font) => sum + font.bytes, 0)),
      spec.fonts.kb,
    );
  }
  await context.close();
}
await browser.close();

// adm1 boundaries: the raw file (stricter than its gzipped transfer).
const topo = join(here, "..", "packages", "mocks", "fixtures", COUNTRY, "geo", "adm1.topo.json");
if (existsSync(topo)) {
  const raw = readFileSync(topo);
  check(`adm1 TopoJSON (${COUNTRY}), raw`, Math.round(raw.length / KB), 150);
  check(`adm1 TopoJSON (${COUNTRY}), gzipped`, Math.round(gzipSync(raw).length / KB), null);
}

const width = Math.max(...results.map((row) => row.label.length));
for (const row of results) {
  const limit = row.limit === null ? "(report only)" : `≤ ${row.limit} ${row.unit}`;
  const mark = row.limit === null ? " " : row.over ? "✗" : "✓";
  console.log(
    `${mark} ${row.label.padEnd(width)}  ${String(row.value).padStart(5)} ${row.unit.padEnd(5)} ${limit}`,
  );
}
const out = process.argv.indexOf("--json");
if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify(results, null, 2));
if (failures.length) {
  console.error(`\nOver budget: ${failures.join(", ")}`);
  process.exit(1);
}
