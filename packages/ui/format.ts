// Number and period formatting from brief §6. Takes a BCP 47 tag from config.numberFormat, so a
// locale with thin Intl data (wo) formats through its configured fallback.

/** Format kinds are the unit variant codes from the API (`unitVariants[].code`). */
export type FormatKind =
  | "pct"
  | "per100"
  | "count"
  | "score"
  | "pctGni"
  | "pctGdp"
  | "mbps"
  | "gbps"
  | "xof"
  | "hhi"
  | (string & {});

export const EMPTY_VALUE = "—";

const PERCENT_KINDS = new Set(["pct"]);
const DECIMAL_KINDS = new Set(["per100", "score", "pctGni", "pctGdp", "mbps", "gbps"]);
const INTEGER_KINDS = new Set(["count", "hhi"]);

export interface FormatOptions {
  /** Short form for cards: 1.2 M, 850 k. */
  compact?: boolean;
  currency?: string;
}

export function formatValue(
  value: number | null | undefined,
  kind: FormatKind,
  tag: string,
  options: FormatOptions = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY_VALUE;
  if (PERCENT_KINDS.has(kind)) {
    return new Intl.NumberFormat(tag, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value / 100);
  }
  if (kind === "xof" || options.currency) {
    return new Intl.NumberFormat(tag, {
      style: "currency",
      currency: options.currency ?? "XOF",
      notation: options.compact ? "compact" : "standard",
      maximumFractionDigits: options.compact ? 1 : 0,
    }).format(value);
  }
  if (options.compact && Math.abs(value) >= 10_000) {
    return new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 }).format(
      value,
    );
  }
  if (DECIMAL_KINDS.has(kind)) {
    return new Intl.NumberFormat(tag, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat(tag, {
    maximumFractionDigits: INTEGER_KINDS.has(kind) ? 0 : 1,
  }).format(value);
}

/** Whether the formatted value already carries its unit, so the label can be left out. */
export function unitIsInline(kind: FormatKind) {
  return PERCENT_KINDS.has(kind) || kind === "xof";
}

/** `2025` stays `2025`; `2025-Q3` becomes `T3 2025` in French and `Q3 2025` elsewhere. */
export function formatPeriod(period: string, tag: string) {
  const match = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!match) return period;
  const prefix = tag.toLowerCase().startsWith("fr") ? "T" : "Q";
  return `${prefix}${match[2]} ${match[1]}`;
}

/** Signed percentage change, with the flat band from the KpiCard spec (±0.5 %). */
export function describeChange(changePct: number | undefined, higherIsBetter: boolean) {
  if (changePct === undefined) return undefined;
  const flat = Math.abs(changePct) < 0.5;
  const up = changePct > 0;
  return {
    direction: flat ? ("flat" as const) : up ? ("up" as const) : ("down" as const),
    tone: flat
      ? ("neutral" as const)
      : up === higherIsBetter
        ? ("good" as const)
        : ("bad" as const),
  };
}
