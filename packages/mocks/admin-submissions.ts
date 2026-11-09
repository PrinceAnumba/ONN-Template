// Submission values, quality rules and history for the back-office mock (brief §7).
import { nextPeriod, valueIssues } from "@onn/api-client/quality";
import type {
  ObsStatus,
  Observation,
  QualityResult,
  QualityRule,
  SubmissionEvent,
  SubmissionStatus,
} from "@onn/api-client/types";

/** A stored row: names are resolved per request, issues are derived by `evaluate`. */
export interface StoredRow {
  id: string;
  indicator: string;
  area: string;
  period: string;
  dims: Record<string, string>;
  value: number | null;
  unit: string;
  status: ObsStatus;
  published: number | null;
}

export interface RowIssue {
  rule: QualityRule;
  level: "error" | "warning";
}

const RULES: { rule: QualityRule; level: "error" | "warning" }[] = [
  { rule: "missing", level: "error" },
  { rule: "negative", level: "error" },
  { rule: "range", level: "error" },
  { rule: "duplicate", level: "error" },
  { rule: "jump", level: "warning" },
];

/** Issues for each row, keyed by row id. Value checks are shared with the entry grid. */
export function rowIssues(rows: StoredRow[], previous: (row: StoredRow) => number | null) {
  const seen = new Set<string>();
  const issues = new Map<string, RowIssue[]>();
  for (const row of rows) {
    const found: RowIssue[] = [];
    const key = `${row.indicator}|${row.area}|${row.period}|${JSON.stringify(row.dims)}`;
    if (seen.has(key)) found.push({ rule: "duplicate", level: "error" });
    seen.add(key);
    found.push(...valueIssues(row.value, row.unit, row.published ?? previous(row)));
    issues.set(row.id, found);
  }
  return issues;
}

/** Rule results for the *Quality* tab: every rule, passing or failing. */
export function qualityResults(
  issues: Map<string, RowIssue[]>,
  justifications: Partial<Record<QualityRule, string>>,
): QualityResult[] {
  return RULES.map(({ rule, level }) => {
    const rowIds = [...issues].filter(([, list]) => list.some((item) => item.rule === rule));
    return {
      rule,
      level,
      status: rowIds.length ? "fail" : "pass",
      rowIds: rowIds.map(([id]) => id),
      ...(justifications[rule] ? { justification: justifications[rule] } : {}),
    };
  });
}

export { nextPeriod };

/** The order a submission moves through; "returned" sends it back to the contributor. */
export const STEPS: SubmissionStatus[] = [
  "draft",
  "submitted",
  "verified",
  "approved",
  "published",
];

/** Applies published rows to the observations the public endpoints read. */
export function applyRows(
  observations: Observation[],
  rows: StoredRow[],
  source: (code: string) => string,
) {
  const touched: Observation[] = [];
  for (const row of rows) {
    if (row.value === null) continue;
    const existing = observations.find(
      (item) =>
        item.indicator === row.indicator &&
        item.area === row.area &&
        item.period === row.period &&
        JSON.stringify(item.dims) === JSON.stringify(row.dims),
    );
    if (existing) {
      existing.value = row.value;
      existing.status = row.status;
      existing.version += 1;
      touched.push(existing);
    } else {
      const added: Observation = {
        indicator: row.indicator,
        area: row.area,
        period: row.period,
        dims: row.dims,
        value: row.value,
        unit: row.unit,
        status: row.status,
        source: source(row.indicator),
        version: 1,
      };
      observations.push(added);
      touched.push(added);
    }
  }
  return touched;
}

export type HistoryEvent = Omit<SubmissionEvent, "actor"> & { actor: string };
