import type {
  Connector,
  ConnectorDryRun,
  ConnectorRun,
  ConnectorSummary,
  ConnectorTestResult,
  IndicatorAdmin,
  Indicator,
  Page,
  IndicatorAdminSummary,
  Problem,
  QualityOverview,
  SubmissionDetail,
  AdminOverview,
} from "@onn/api-client/types";
import SEN from "@onn/config/countries/SEN";
import { getResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { generateFixtures } from "./fixtures";
import { createHandlers } from "./handlers";
import { loadBoundaries } from "./load";

const onPublished = vi.fn();
const handlers = createHandlers(generateFixtures(SEN, 42, loadBoundaries("SEN")), {
  latency: [0, 0],
  onPublished,
});

async function call(path: string, user: string, init: { method?: string; body?: unknown } = {}) {
  const headers = new Headers({ "Accept-Language": "en", Authorization: `Bearer ${user}` });
  let body: string | undefined;
  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.body);
  }
  const response = await getResponse(
    handlers,
    new Request(`http://localhost/api/v1${path}`, {
      method: init.method ?? (body ? "POST" : "GET"),
      headers,
      body,
    }),
  );
  if (!response) throw new Error(`No handler for ${path}`);
  return response;
}
const json = async <T>(response: Response) => (await response.json()) as T;

describe("connectors", () => {
  it("lists connectors for editors and hides them from contributors", async () => {
    const list = await json<ConnectorSummary[]>(await call("/admin/connectors", "u-editor"));
    expect(list.length).toBe(4);
    expect(list.filter((item) => item.lastRun?.status === "failed")).toHaveLength(1);
    expect((await call("/admin/connectors", "u-contributor")).status).toBe(403);
    // Editors view but can't change.
    expect((await call("/admin/connectors/CON-1/run", "u-editor", { method: "POST" })).status).toBe(
      403,
    );
  });

  it("fails the broken source until its endpoint changes, then runs into a submission", async () => {
    const broken = await json<Connector>(await call("/admin/connectors/CON-2", "u-admin"));
    expect(broken.runs[0]?.status).toBe("failed");
    const test = await json<ConnectorTestResult>(
      await call("/admin/connectors/test", "u-admin", {
        body: { type: broken.type, endpoint: broken.endpoint, auth: broken.auth },
      }),
    );
    expect(test).toMatchObject({ ok: false, error: "unreachable" });
    const scheme = await json<ConnectorTestResult>(
      await call("/admin/connectors/test", "u-admin", {
        body: { type: "sftp", endpoint: "https://x.example.org" },
      }),
    );
    expect(scheme.error).toBe("scheme");
    const failedRun = await json<ConnectorRun>(
      await call("/admin/connectors/CON-2/run", "u-admin", { method: "POST" }),
    );
    expect(failedRun.status).toBe("failed");

    const endpoint = broken.endpoint.replace("api.", "api2.");
    const ok = await json<ConnectorTestResult>(
      await call("/admin/connectors/test", "u-admin", {
        body: { type: broken.type, endpoint, auth: broken.auth },
      }),
    );
    expect(ok.ok).toBe(true);
    expect(ok.fields.length).toBeGreaterThan(3);

    // Invalid schedule and incomplete mapping are refused with field paths.
    const refused = await call("/admin/connectors/CON-2", "u-admin", {
      method: "PUT",
      body: { ...broken, endpoint, schedule: "every monday", mapping: [] },
    });
    expect(refused.status).toBe(422);
    const paths = (await json<Problem>(refused)).errors?.map((item) => item.path);
    expect(paths).toEqual(expect.arrayContaining(["schedule", "mapping.value"]));

    const saved = await json<Connector>(
      await call("/admin/connectors/CON-2", "u-admin", {
        method: "PUT",
        body: { ...broken, endpoint, schedule: "0 6 * * 1" },
      }),
    );
    expect(saved.endpoint).toBe(endpoint);

    const dry = await json<ConnectorDryRun>(
      await call("/admin/connectors/CON-2/dry-run", "u-admin", { body: {} }),
    );
    expect(dry.rows.length).toBeGreaterThan(0);
    expect(dry.rows.length).toBeLessThanOrEqual(50);
    expect(dry.total).toBeGreaterThanOrEqual(dry.rows.length);

    const run = await json<ConnectorRun>(
      await call("/admin/connectors/CON-2/run", "u-admin", { method: "POST" }),
    );
    expect(run.status).toBe("ok");
    expect(run.submission).toMatch(/^SUB-/);
    const submission = await json<SubmissionDetail>(
      await call(`/admin/submissions/${run.submission}`, "u-admin"),
    );
    expect(submission).toMatchObject({ channel: "connector", status: "submitted" });

    const overview = await json<AdminOverview>(await call("/admin/overview", "u-admin"));
    expect(overview.connectorFailures).toEqual([]);
  });
});

describe("quality", () => {
  it("rates rows by organisation, indicator and month, and lists open warnings", async () => {
    const quality = await json<QualityOverview>(await call("/admin/quality", "u-admin"));
    expect(quality.passRate).toBeGreaterThan(0);
    expect(quality.passRate).toBeLessThanOrEqual(1);
    expect(quality.byMonth).toHaveLength(6);
    expect(quality.byOrg.reduce((sum, item) => sum + item.checked, 0)).toBe(quality.checked);
    expect(quality.warnings.every((item) => item.rule === "jump")).toBe(true);
    const overview = await json<AdminOverview>(await call("/admin/overview", "u-admin"));
    expect(overview.quality.passRate).toBe(quality.passRate);
    expect(overview.quality.openWarnings).toBe(quality.warnings.length);
  });
});

describe("indicator referential", () => {
  it("lists with priority scores and filters", async () => {
    const page = await json<Page<IndicatorAdminSummary>>(
      await call("/admin/indicators?sort=priority&pageSize=100", "u-editor"),
    );
    expect(page.meta.total).toBeGreaterThan(20);
    expect(page.items[0]!.priority).toBeGreaterThanOrEqual(page.items.at(-1)!.priority);
    const planned = await json<Page<IndicatorAdminSummary>>(
      await call("/admin/indicators?status=planned", "u-editor"),
    );
    expect(planned.items.every((item) => item.status === "planned")).toBe(true);
    expect((await call("/admin/indicators", "u-contributor")).status).toBe(403);
  });

  it("saves a new version with a note and updates the public metadata", async () => {
    const before = await json<IndicatorAdmin>(
      await call("/admin/indicators/CONN.4G_POP", "u-admin"),
    );
    const indicator = { ...before, name: { ...before.name, en: "4G coverage (population)" } };

    expect(
      (
        await call("/admin/indicators/CONN.4G_POP", "u-editor", {
          method: "PUT",
          body: { indicator, note: "x" },
        })
      ).status,
    ).toBe(403);
    const noNote = await call("/admin/indicators/CONN.4G_POP", "u-admin", {
      method: "PUT",
      body: { indicator },
    });
    expect((await json<Problem>(noNote)).errors).toEqual([{ path: "note", message: "required" }]);
    const bad = await call("/admin/indicators/CONN.4G_POP", "u-admin", {
      method: "PUT",
      body: {
        indicator: { ...indicator, goalposts: { ...indicator.goalposts, min: 50, max: 10 } },
        note: "Rename",
      },
    });
    expect((await json<Problem>(bad)).errors?.map((item) => item.path)).toContain("goalposts.max");
    const unchanged = await call("/admin/indicators/CONN.4G_POP", "u-admin", {
      method: "PUT",
      body: { indicator: before, note: "Nothing" },
    });
    expect((await json<Problem>(unchanged)).type).toBe("unchanged");

    onPublished.mockClear();
    const saved = await json<IndicatorAdmin>(
      await call("/admin/indicators/CONN.4G_POP", "u-admin", {
        method: "PUT",
        body: { indicator, note: "Clearer English name" },
      }),
    );
    expect(saved.version).toBe(before.version + 1);
    expect(saved.versions[0]).toMatchObject({
      note: "Clearer English name",
      changes: ["name"],
      author: { id: "u-admin" },
    });
    expect(onPublished).toHaveBeenCalledWith(expect.arrayContaining(["indicator:CONN.4G_POP"]));
    const response = await getResponse(
      handlers,
      new Request("http://localhost/api/v1/indicators/CONN.4G_POP", {
        headers: { "Accept-Language": "en" },
      }),
    );
    const publicIndicator = (await response!.json()) as Indicator;
    expect(publicIndicator.name).toBe("4G coverage (population)");
    expect(publicIndicator.versions.at(-1)?.version).toBe(saved.version);
  });

  it("creates a planned indicator", async () => {
    const created = await call("/admin/indicators", "u-admin", {
      body: {
        code: "CONN.TEST",
        name: { fr: "Essai" },
        pillar: "CONN",
        theme: "COVERAGE",
        org: "RA",
      },
    });
    if (created.status !== 201) {
      // The organisation code depends on the catalogue's names; use the first one.
      const me = await json<{ orgs: { code: string }[] }>(await call("/admin/me", "u-admin"));
      const retry = await call("/admin/indicators", "u-admin", {
        body: {
          code: "CONN.TEST",
          name: { fr: "Essai" },
          pillar: "CONN",
          theme: "COVERAGE",
          org: me.orgs[0]!.code,
        },
      });
      expect(retry.status).toBe(201);
    }
    const duplicate = await call("/admin/indicators", "u-admin", {
      body: {
        code: "CONN.TEST",
        name: { fr: "Essai" },
        pillar: "CONN",
        theme: "COVERAGE",
        org: "x",
      },
    });
    expect((await json<Problem>(duplicate)).errors?.[0]).toEqual({
      path: "code",
      message: "duplicate",
    });
    const item = await json<IndicatorAdmin>(await call("/admin/indicators/CONN.TEST", "u-admin"));
    expect(item).toMatchObject({ status: "planned", version: 1 });
  });
});
