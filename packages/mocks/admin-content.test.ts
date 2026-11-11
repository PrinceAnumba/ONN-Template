import type {
  DashboardAdmin,
  DashboardAdminSummary,
  Dashboard,
  ExportJob,
  Page,
  Problem,
  Publication,
  PublicationAdmin,
  ReportAdmin,
  ReportComment,
  ReportSummary,
} from "@onn/api-client/types";
import SEN from "@onn/config/countries/SEN";
import { getResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SIGNING_MS } from "./admin-content";
import { generateFixtures } from "./fixtures";
import { createHandlers } from "./handlers";
import { loadBoundaries } from "./load";

const onPublished = vi.fn();
const handlers = createHandlers(generateFixtures(SEN, 42, loadBoundaries("SEN")), {
  latency: [0, 0],
  onPublished,
});

async function call(
  path: string,
  user: string | null,
  init: { method?: string; body?: unknown; form?: FormData } = {},
) {
  const headers = new Headers({ "Accept-Language": "en" });
  if (user) headers.set("Authorization", `Bearer ${user}`);
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
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

afterEach(() => {
  vi.useRealTimers();
});

describe("dashboards", () => {
  it("lists the seeded dashboards as published and hides them from contributors", async () => {
    const list = await json<DashboardAdminSummary[]>(await call("/admin/dashboards", "u-editor"));
    expect(list.length).toBe(3);
    expect(list.every((item) => item.status === "published")).toBe(true);
    expect((await call("/admin/dashboards", "u-contributor")).status).toBe(403);
  });

  it("marks unpublished edits, publishes them to the portal and unpublishes", async () => {
    const before = await json<DashboardAdmin>(await call("/admin/dashboards/analysts", "u-editor"));
    const widgets = [...before.widgets]
      .reverse()
      .map((widget, index) =>
        index === 0
          ? { ...widget, span: 3, title: { ...widget.title, en: "Moved first" } }
          : widget,
      );
    const saved = await json<DashboardAdmin>(
      await call("/admin/dashboards/analysts", "u-editor", {
        method: "PUT",
        body: { ...before, widgets },
      }),
    );
    expect(saved.status).toBe("changed");
    // The portal still shows the live version.
    let live = await json<Dashboard>(await call("/dashboards/analysts", null));
    expect(live.widgets[0]!.title).not.toBe("Moved first");

    onPublished.mockClear();
    const published = await json<DashboardAdmin>(
      await call("/admin/dashboards/analysts/publish", "u-editor", { method: "POST" }),
    );
    expect(published.status).toBe("published");
    expect(onPublished).toHaveBeenCalledWith(expect.arrayContaining(["dashboard:analysts"]));
    live = await json<Dashboard>(await call("/dashboards/analysts", null));
    expect(live.widgets[0]).toMatchObject({ title: "Moved first", span: 3 });

    await call("/admin/dashboards/analysts/unpublish", "u-editor", { method: "POST" });
    expect((await call("/dashboards/analysts", null)).status).toBe(404);
  });

  it("validates widgets by path and creates drafts", async () => {
    const before = await json<DashboardAdmin>(await call("/admin/dashboards/public", "u-editor"));
    const response = await call("/admin/dashboards/public", "u-editor", {
      method: "PUT",
      body: {
        ...before,
        widgets: [
          { id: "a", type: "line", title: { en: "" }, indicators: ["NOPE.X"], span: 4 },
          { id: "a", type: "kpi", title: { fr: "x" }, indicators: [], span: 1, years: "2024-2019" },
        ],
      },
    });
    expect(response.status).toBe(422);
    const paths = (await json<Problem>(response)).errors?.map((error) => error.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "widgets.0.title.fr",
        "widgets.0.indicators",
        "widgets.0.span",
        "widgets.1.id",
        "widgets.1.indicators",
        "widgets.1.years",
      ]),
    );

    const created = await call("/admin/dashboards", "u-editor", {
      body: { slug: "regions", title: { fr: "Régions" }, audience: "public" },
    });
    expect(created.status).toBe(201);
    expect(await json<DashboardAdmin>(created)).toMatchObject({ status: "draft", widgets: [] });
    const duplicate = await call("/admin/dashboards", "u-editor", {
      body: { slug: "regions", title: { fr: "Régions" }, audience: "public" },
    });
    expect((await json<Problem>(duplicate)).errors?.[0]).toMatchObject({
      path: "slug",
      message: "duplicate",
    });
    // An empty dashboard can't be published.
    const empty = await call("/admin/dashboards/regions/publish", "u-editor", { method: "POST" });
    expect((await json<Problem>(empty)).type).toBe("empty");
  });

  it("publishes a new dashboard with no description as an empty string", async () => {
    await call("/admin/dashboards", "u-editor", {
      body: { slug: "no-description", title: { fr: "Sans description" }, audience: "public" },
    });
    const draft = await json<DashboardAdmin>(
      await call("/admin/dashboards/no-description", "u-editor"),
    );
    const widget = { id: "w1", type: "kpi", title: { fr: "Indicateur" }, span: 1 };
    const indicators = [draft.widgets[0]?.indicators[0] ?? "ACCESS.INTERNET_USERS"];
    await call("/admin/dashboards/no-description", "u-editor", {
      method: "PUT",
      body: { ...draft, widgets: [{ ...widget, indicators }] },
    });
    await call("/admin/dashboards/no-description/publish", "u-editor", { method: "POST" });
    const live = await json<Dashboard>(await call("/dashboards/no-description", null));
    expect(live.description).toBe("");
    expect(live.title).toBe("Sans description");
  });
});

describe("publications", () => {
  const meta = {
    slug: "study-test",
    type: "study",
    period: "2026",
    date: "2026-11-01",
    title: { fr: "Étude test" },
    summary: { fr: "Résumé" },
  };
  const form = (fields: Record<string, unknown>, file?: [string, string]) => {
    const data = new FormData();
    data.set("meta", JSON.stringify(fields));
    if (file) data.set("file", new File([file[1]], file[0], { type: "application/pdf" }));
    return data;
  };

  it("uploads, waits for the signature, then publishes to the portal", async () => {
    const created = await call("/admin/publications", "u-editor", {
      form: form(meta, ["study.pdf", "%PDF-1.7\n%%EOF\n"]),
    });
    expect(created.status).toBe(201);
    const item = await json<PublicationAdmin>(created);
    expect(item.signature).toBe("pending");
    const refused = await call("/admin/publications/study-test/publish", "u-editor", {
      method: "POST",
    });
    expect((await json<Problem>(refused)).type).toBe("unsigned");

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + SIGNING_MS + 1);
    const signed = await json<PublicationAdmin>(
      await call("/admin/publications/study-test", "u-editor"),
    );
    expect(signed.signature).toBe("signed");
    await call("/admin/publications/study-test/publish", "u-editor", { method: "POST" });
    const live = await json<Page<Publication>>(await call("/publications?q=test", null));
    expect(live.items.map((entry) => entry.slug)).toContain("study-test");
    const pdf = await call("/publications/study-test/file.pdf", null);
    expect(await pdf.text()).toContain("%PDF-1.7");
    // A live file can't be replaced.
    const replace = new FormData();
    replace.set("file", new File(["%PDF-1.7"], "new.pdf"));
    const conflict = await call("/admin/publications/study-test/files", "u-editor", {
      form: replace,
    });
    expect(conflict.status).toBe(409);
  });

  it("fails the signature for a file that isn't a PDF and validates metadata", async () => {
    await call("/admin/publications", "u-editor", {
      form: form({ ...meta, slug: "fake-pdf" }, ["fake.pdf", "not a pdf"]),
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + SIGNING_MS + 1);
    const item = await json<PublicationAdmin>(
      await call("/admin/publications/fake-pdf", "u-editor"),
    );
    expect(item.signature).toBe("failed");

    const response = await call("/admin/publications", "u-editor", {
      form: form({ ...meta, slug: "Bad Slug", type: "quarterly", period: "2026", title: {} }),
    });
    const paths = (await json<Problem>(response)).errors?.map((error) => error.path);
    expect(paths).toEqual(expect.arrayContaining(["slug", "period", "title.fr", "file"]));
  });
});

describe("reports", () => {
  it("creates from a template, saves block order and keeps comment threads", async () => {
    const list = await json<ReportSummary[]>(await call("/admin/reports", "u-editor"));
    expect(list[0]).toMatchObject({ id: "REP-1", openComments: 1 });

    const created = await json<ReportAdmin>(
      await call("/admin/reports", "u-editor", {
        body: { template: "annual", period: "2025", title: "Annual 2025" },
      }),
    );
    expect(created.blocks.map((block) => block.type)).toEqual([
      "text",
      "kpis",
      "chart",
      "text",
      "map",
      "table",
      "text",
    ]);

    const report = await json<ReportAdmin>(await call("/admin/reports/REP-1", "u-editor"));
    const intro = report.blocks[0]!;
    const comment = await json<ReportComment>(
      await call(`/admin/reports/REP-1/blocks/${intro.id}/comments`, "u-admin", {
        body: { text: "Looks good" },
      }),
    );
    await call(`/admin/reports/REP-1/blocks/${intro.id}/comments/${comment.id}`, "u-editor", {
      method: "PATCH",
      body: { resolved: true },
    });
    // Reverse the blocks; comments sent in the body are ignored, the stored thread is kept.
    const saved = await json<ReportAdmin>(
      await call("/admin/reports/REP-1", "u-editor", {
        method: "PUT",
        body: {
          ...report,
          blocks: [...report.blocks]
            .reverse()
            .map((block) => (block.type === "text" ? { ...block, comments: [] } : block)),
        },
      }),
    );
    const moved = saved.blocks.at(-1)!;
    expect(moved.id).toBe(intro.id);
    expect(moved.type === "text" && moved.comments.map((item) => item.resolved)).toEqual([
      false,
      true,
    ]);

    const bad = await call("/admin/reports/REP-1", "u-editor", {
      method: "PUT",
      body: { ...report, period: "2025", blocks: [{ id: "x", type: "chart", indicator: "" }] },
    });
    const paths = (await json<Problem>(bad)).errors?.map((error) => error.path);
    expect(paths).toEqual(["period", "blocks.0.indicator"]);
  });

  it("runs an export job with progress", async () => {
    const { jobId } = await json<{ jobId: string }>(
      await call("/admin/reports/REP-1/exports", "u-editor", { body: { format: "docx" } }),
    );
    const states: ExportJob[] = [];
    for (let i = 0; i < 4; i++) {
      states.push(await json<ExportJob>(await call(`/admin/exports/${jobId}`, "u-editor")));
    }
    expect(states.map((job) => job.status)).toEqual(["queued", "running", "running", "done"]);
    expect(states[2]!.progress).toBeGreaterThan(states[1]!.progress!);
    const file = await call(states[3]!.url!.replace(/^\/admin/, "/admin"), "u-editor");
    expect(file.headers.get("content-disposition")).toContain("attachment");
  });
});
