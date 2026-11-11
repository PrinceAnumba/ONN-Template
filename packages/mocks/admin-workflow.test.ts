import type {
  BulkTransitionResult,
  Problem,
  Series,
  SubmissionDetail,
  SubmissionPage,
} from "@onn/api-client/types";
import SEN from "@onn/config/countries/SEN";
import { getResponse } from "msw";
import { describe, expect, it } from "vitest";
import { generateFixtures } from "./fixtures";
import { createHandlers } from "./handlers";
import { loadBoundaries } from "./load";

const published: string[][] = [];
const handlers = createHandlers(generateFixtures(SEN, 42, loadBoundaries("SEN")), {
  latency: [0, 0],
  onPublished: (tags) => published.push(tags),
});

async function call(path: string, user?: string, body?: unknown, method = body ? "POST" : "GET") {
  const headers = new Headers({ "Accept-Language": "en" });
  if (user) headers.set("Authorization", `Bearer ${user}`);
  if (body) headers.set("Content-Type", "application/json");
  const response = await getResponse(
    handlers,
    new Request(`http://localhost/api/v1${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
  if (!response) throw new Error(`No handler for ${method} ${path}`);
  return response;
}
const json = async <T>(response: Response) => (await response.json()) as T;
const list = (query: string, user = "u-admin") =>
  call(`/admin/submissions?${query}`, user).then((r) => json<SubmissionPage>(r));
const detail = (id: string, user = "u-admin") =>
  call(`/admin/submissions/${id}`, user).then((r) => json<SubmissionDetail>(r));
const act = (id: string, user: string, action: string, comment?: string) =>
  call(`/admin/submissions/${id}/transition`, user, { action, comment });

describe("submissions list", () => {
  it("counts every status tab and filters by status", async () => {
    const all = await list("");
    const total = Object.values(all.counts).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(all.meta.total);
    const submitted = await list("status=submitted");
    expect(submitted.items.every((item) => item.status === "submitted")).toBe(true);
    expect(submitted.meta.total).toBe(all.counts.submitted);
  });

  it("pages with 25, 50 or 100 rows only", async () => {
    expect((await list("pageSize=50")).meta.pageSize).toBe(50);
    expect((await list("pageSize=7")).meta.pageSize).toBe(25);
  });

  it("searches by id", async () => {
    const found = await list("q=SUB-0003");
    expect(found.items.map((item) => item.id)).toEqual(["SUB-0003"]);
  });

  it("scopes contributors to their organisations", async () => {
    const mine = await list("", "u-contributor");
    const all = await list("");
    expect(mine.meta.total).toBeLessThan(all.meta.total);
  });
});

describe("workflow", () => {
  it("refuses to submit a draft with errors", async () => {
    const draft = (await list("status=draft", "u-contributor")).items[0]!;
    const item = await detail(draft.id, "u-contributor");
    expect(item.quality.some((rule) => rule.level === "error" && rule.status === "fail")).toBe(
      true,
    );
    const response = await act(draft.id, "u-contributor", "submit");
    expect(response.status).toBe(422);
    expect((await json<Problem>(response)).type).toBe("errors");
  });

  it("refuses actions the role can't take", async () => {
    const submitted = (await list("status=submitted")).items[0]!;
    expect((await act(submitted.id, "u-contributor", "verify")).status).toBe(403);
    expect((await act(submitted.id, "u-reader", "return", "x")).status).toBe(403);
  });

  it("needs a comment to return", async () => {
    const submitted = (await list("status=submitted")).items[0]!;
    expect((await act(submitted.id, "u-editor", "return")).status).toBe(422);
    const ok = await act(submitted.id, "u-editor", "return", "Please check the regions.");
    const item = await json<SubmissionDetail>(ok);
    expect(item.status).toBe("returned");
    expect(item.history.at(-1)?.comment).toBe("Please check the regions.");
  });

  it("refuses to approve your own submission", async () => {
    const verified = (await list("status=verified")).items;
    const own = verified.find((item) => item.submittedBy.id === "u-admin")!;
    expect(own).toBeDefined();
    const response = await act(own.id, "u-admin", "approve");
    expect(response.status).toBe(409);
    expect((await json<Problem>(response)).type).toBe("own-submission");
    expect((await act(own.id, "u-admin2", "approve")).status).toBe(200);
  });

  it("runs submit → verify → approve → publish and the value reaches the portal", async () => {
    const submitted = (await list("status=submitted")).items;
    // One with a warning, to check justifications are required.
    let target: SubmissionDetail | undefined;
    for (const item of submitted) {
      const full = await detail(item.id, "u-editor");
      if (full.quality.some((rule) => rule.level === "warning" && rule.status === "fail")) {
        target = full;
        break;
      }
    }
    expect(target).toBeDefined();
    const id = target!.id;
    const verify = await act(id, "u-editor", "verify");
    expect(verify.status).toBe(422);
    expect((await json<Problem>(verify)).type).toBe("unjustified");
    await call(
      `/admin/submissions/${id}/justifications`,
      "u-editor",
      { justifications: { jump: "New towers" } },
      "PUT",
    );
    expect((await act(id, "u-editor", "verify")).status).toBe(200);
    const approver = target!.submittedBy.id === "u-admin" ? "u-admin2" : "u-admin";
    expect((await act(id, approver, "approve")).status).toBe(200);
    expect((await act(id, approver, "publish")).status).toBe(200);

    const done = await detail(id);
    expect(done.status).toBe("published");
    expect(done.history.map((event) => event.to)).toEqual(
      expect.arrayContaining(["submitted", "verified", "approved", "published"]),
    );
    const row = done.rows.find((item) => item.value !== null)!;
    const series = await json<Series[]>(
      await call(`/series?indicator=${row.indicator}&area=${row.area}`),
    );
    const point = series[0]!.points.find((p) => p.period === row.period);
    expect(point?.value).toBe(row.value);
    expect(published.at(-1)).toContain(`indicator:${row.indicator}`);
    // The catalogue's coverage reaches the published period, so the portal's year range does too.
    const indicator = await json<{ coverage: { to: string } }>(
      await call(`/indicators/${row.indicator}`),
    );
    expect(indicator.coverage.to >= row.period).toBe(true);
  });

  it("applies bulk transitions one by one and reports failures", async () => {
    const submitted = (await list("status=submitted")).items.map((item) => item.id);
    const result = await json<BulkTransitionResult>(
      await call("/admin/submissions/bulk-transition", "u-editor", {
        ids: [...submitted, "SUB-9999"],
        action: "return",
        comment: "Batch check",
      }),
    );
    expect(result.done.length).toBe(submitted.length);
    expect(result.failed).toEqual([{ id: "SUB-9999", status: 404, detail: "Not found" }]);
  });
});

describe("calendar", () => {
  it("lists the deadlines in a month", async () => {
    const month = new Date().toISOString().slice(0, 7);
    const items = await json<{ deadline: string }[]>(
      await call(`/admin/calendar?month=${month}`, "u-admin"),
    );
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.deadline.startsWith(month))).toBe(true);
  });
});
