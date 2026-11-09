import type {
  AdminMe,
  EntryIndicator,
  EntrySaveResult,
  EntrySheet,
  ImportJob,
  Problem,
  SubmissionDetail,
} from "@onn/api-client/types";
import SEN from "@onn/config/countries/SEN";
import { getResponse } from "msw";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { autoMatch, parseCsv } from "./admin-intake";
import { generateFixtures } from "./fixtures";
import { createHandlers } from "./handlers";
import { loadBoundaries } from "./load";

const handlers = createHandlers(generateFixtures(SEN, 42, loadBoundaries("SEN")), {
  latency: [0, 0],
});

async function call(path: string, user: string, init: { method?: string; body?: unknown } = {}) {
  const headers = new Headers({ "Accept-Language": "en", Authorization: `Bearer ${user}` });
  let body: BodyInit | undefined;
  if (init.body instanceof FormData) body = init.body;
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
/** Imports finish their background work on the next poll after a short delay. */
const later = () => vi.setSystemTime(Date.now() + 1000);

beforeAll(() => vi.useFakeTimers({ toFake: ["Date"] }));
afterAll(() => vi.useRealTimers());

describe("file parsing", () => {
  it("reads quoted CSV with either delimiter", () => {
    expect(parseCsv('a;b\r\n"x;1";"say ""hi"""\n')).toEqual([
      ["a", "b"],
      ["x;1", 'say "hi"'],
    ]);
    expect(parseCsv("a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("matches headers in either language", () => {
    const columns = autoMatch(
      ["Indicateur", "Région", "Année", "Valeur", "Sexe", "Note"],
      ["indicator", "area", "period", "value", "flag", "dim:sex", "ignore"],
    );
    expect(columns.map((column) => column.target)).toEqual([
      "indicator",
      "area",
      "period",
      "value",
      "dim:sex",
      "ignore",
    ]);
  });
});

describe("import wizard", () => {
  it("finds the five seeded errors, takes fixes and submits", async () => {
    const me = await json<AdminMe>(await call("/admin/me", "u-contributor"));
    let org = "";
    let csv = "";
    for (const candidate of me.orgs) {
      const text = await (
        await call(`/admin/imports/template?org=${candidate.code}&demo=errors`, "u-contributor")
      ).text();
      if (text.trim().split("\n").length >= 8) {
        org = candidate.code;
        csv = text;
        break;
      }
    }
    expect(org).not.toBe("");

    const form = new FormData();
    form.set("org", org);
    form.set("file", new File([csv], "demo.csv", { type: "text/csv" }));
    let job = await json<ImportJob>(await call("/admin/imports", "u-contributor", { body: form }));
    expect(job.status).toBe("parsing");
    later();
    job = await json<ImportJob>(await call(`/admin/imports/${job.id}`, "u-contributor"));
    expect(job.status).toBe("mapping");
    expect(job.columns.every((column) => column.auto)).toBe(true);

    const mapping = Object.fromEntries(job.columns.map((column) => [column.source, column.target]));
    const bad = await call(`/admin/imports/${job.id}/mapping`, "u-contributor", {
      method: "PUT",
      body: { columns: { ...mapping, value: "ignore" } },
    });
    expect(((await bad.json()) as Problem).type).toBe("mapping");
    await call(`/admin/imports/${job.id}/mapping`, "u-contributor", {
      method: "PUT",
      body: { columns: mapping },
    });
    later();
    job = await json<ImportJob>(await call(`/admin/imports/${job.id}`, "u-contributor"));
    expect(job.status).toBe("validated");
    const errors = job.issues!.filter((issue) => issue.level === "error");
    expect(errors.map((issue) => issue.rule).sort()).toEqual(
      ["area", "duplicate", "indicator", "negative", "number"].sort(),
    );
    expect(job.counts!.errors).toBe(5);

    const refused = await call(`/admin/imports/${job.id}/submit`, "u-contributor", { body: {} });
    expect(((await refused.json()) as Problem).type).toBe("errors");

    const rows = job.rows!;
    const first = rows[0]!;
    const fixes = errors
      .filter((issue) => issue.rule !== "duplicate")
      .map((issue) => {
        const original = rows[issue.row - 1]!;
        const value =
          issue.field === "area"
            ? first[1]!
            : issue.field === "indicator"
              ? first[0]!
              : String(Math.abs(Number(original[3])) || 1);
        return { row: issue.row, field: issue.field, value };
      });
    const duplicate = errors.find((issue) => issue.rule === "duplicate")!;
    job = await json<ImportJob>(
      await call(`/admin/imports/${job.id}/rows`, "u-contributor", {
        method: "PATCH",
        body: { fixes, remove: [duplicate.row] },
      }),
    );
    // Fixing a code can make a row a duplicate of another; remove any that remain.
    const left = job.issues!.filter((issue) => issue.level === "error");
    if (left.length) {
      job = await json<ImportJob>(
        await call(`/admin/imports/${job.id}/rows`, "u-contributor", {
          method: "PATCH",
          body: { remove: left.map((issue) => issue.row) },
        }),
      );
    }
    expect(job.counts!.errors).toBe(0);

    const done = await json<{ submission: string }>(
      await call(`/admin/imports/${job.id}/submit`, "u-contributor", {
        body: { comment: "Q data" },
      }),
    );
    const submission = await json<SubmissionDetail>(
      await call(`/admin/submissions/${done.submission}`, "u-contributor"),
    );
    expect(submission.status).toBe("submitted");
    expect(submission.channel).toBe("import");
    expect(submission.history.at(-1)?.comment).toBe("Q data");
    job = await json<ImportJob>(await call(`/admin/imports/${job.id}`, "u-contributor"));
    expect(job.status).toBe("submitted");
  });

  it("refuses XLSX in the mock and keeps imports to the user's organisations", async () => {
    const me = await json<AdminMe>(await call("/admin/me", "u-contributor"));
    const form = new FormData();
    form.set("org", me.orgs[0]!.code);
    form.set("file", new File(["PK"], "data.xlsx"));
    let job = await json<ImportJob>(await call("/admin/imports", "u-contributor", { body: form }));
    later();
    job = await json<ImportJob>(await call(`/admin/imports/${job.id}`, "u-contributor"));
    expect(job.status).toBe("failed");
    expect(job.error).toBe("unsupported");
    const reader = await call("/admin/imports", "u-reader", { body: form });
    expect(reader.status).toBe(403);
  });
});

describe("entry grid", () => {
  it("saves a draft, submits it and then locks the sheet", async () => {
    const list = await json<EntryIndicator[]>(await call("/admin/entry", "u-contributor"));
    const target = list.find((item) => item.latest && !item.draft)!;
    expect(target).toBeDefined();
    const path = `/admin/entry/${target.code}?period=${target.next}`;
    let sheet = await json<EntrySheet>(await call(path, "u-contributor"));
    expect(sheet.periods.at(-1)).toBe(target.next);
    expect(sheet.rows[0]!.area).toBe("SEN");

    const row = sheet.rows[0]!;
    const previous = row.values[sheet.periods[1]!] ?? 10;
    const saved = await json<EntrySaveResult>(
      await call(path, "u-contributor", {
        method: "PUT",
        body: {
          cells: [{ area: row.area, dims: row.dims, period: target.next, value: previous + 1 }],
        },
      }),
    );
    sheet = await json<EntrySheet>(await call(path, "u-contributor"));
    expect(sheet.draft?.submission).toBe(saved.submission);
    expect(sheet.rows[0]!.values[target.next]).toBe(previous + 1);

    const submitted = await call(
      `/admin/submissions/${saved.submission}/transition`,
      "u-contributor",
      {
        body: { action: "submit" },
      },
    );
    expect(submitted.status).toBe(200);
    sheet = await json<EntrySheet>(await call(path, "u-contributor"));
    expect(sheet.locked).toBe("submitted");
    const late = await call(path, "u-contributor", { method: "PUT", body: { cells: [] } });
    expect(late.status).toBe(409);
  });
});
