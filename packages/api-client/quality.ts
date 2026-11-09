// Value checks shared by the mock (submission and import validation) and the admin entry grid,
// so a cell flagged while typing is flagged the same way on the server.
import type { QualityRule } from "./types";

export interface ValueIssue {
  rule: QualityRule;
  level: "error" | "warning";
}

/** A change over 30% on the published or previous value needs a justification. */
export const JUMP_RATIO = 0.3;

/** Issues for one value. `base` is the published or previous value; duplicates are checked by
 * the caller, which sees every row. */
export function valueIssues(value: number | null, unit: string, base: number | null): ValueIssue[] {
  if (value === null) return [{ rule: "missing", level: "error" }];
  const found: ValueIssue[] = [];
  if (value < 0) found.push({ rule: "negative", level: "error" });
  if (unit === "%" && value > 100) found.push({ rule: "range", level: "error" });
  if (base && Math.abs(value - base) / Math.abs(base) > JUMP_RATIO) {
    found.push({ rule: "jump", level: "warning" });
  }
  return found;
}

/**
 * Reads a number typed or pasted in either convention: "1 234,5", "1,234.5", "1234.5", "12 %".
 * Returns null for an empty cell and NaN for text that isn't a number.
 */
export function parseNumber(text: string): number | null {
  const trimmed = text.replace(/[\s\u00a0\u202f%]/g, "");
  if (!trimmed) return null;
  let normal = trimmed;
  const comma = normal.lastIndexOf(",");
  const dot = normal.lastIndexOf(".");
  if (comma > -1 && dot > -1) {
    // The later separator is the decimal one.
    normal = comma > dot ? normal.replace(/\./g, "").replace(",", ".") : normal.replace(/,/g, "");
  } else if (comma > -1) {
    // "1,234" (groups of three after commas) is a thousands separator in English files.
    normal = /^-?\d{1,3}(,\d{3})+$/.test(normal)
      ? normal.replace(/,/g, "")
      : normal.replace(",", ".");
  }
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : Number.NaN;
}

/** Period format for a periodicity: 2025, 2025-Q3 or 2025-07. */
export function validPeriod(period: string, periodicity: string) {
  if (periodicity === "quarterly") return /^\d{4}-Q[1-4]$/.test(period);
  if (periodicity === "monthly") return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
  return /^\d{4}$/.test(period);
}

/** The period after `period`: 2025 → 2026 (2027 when biennial), 2025-Q4 → 2026-Q1, 2025-12 →
 * 2026-01. */
export function nextPeriod(period: string, periodicity: string) {
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period);
  if (quarter) {
    const [year, q] = [Number(quarter[1]), Number(quarter[2])];
    return q === 4 ? `${year + 1}-Q1` : `${year}-Q${q + 1}`;
  }
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (month) {
    const [year, m] = [Number(month[1]), Number(month[2])];
    return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
  }
  return String(Number(period.slice(0, 4)) + (periodicity === "biennial" ? 2 : 1));
}

/** The period before `period`, the inverse of `nextPeriod`. */
export function previousPeriod(period: string, periodicity: string) {
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period);
  if (quarter) {
    const [year, q] = [Number(quarter[1]), Number(quarter[2])];
    return q === 1 ? `${year - 1}-Q4` : `${year}-Q${q - 1}`;
  }
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (month) {
    const [year, m] = [Number(month[1]), Number(month[2])];
    return m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, "0")}`;
  }
  return String(Number(period.slice(0, 4)) - (periodicity === "biennial" ? 2 : 1));
}
