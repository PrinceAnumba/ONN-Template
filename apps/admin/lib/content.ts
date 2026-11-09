import type {
  ContentStatus,
  PublicationRecord,
  ReportBlock,
  SignatureStatus,
  Widget,
} from "@onn/api-client/types";
import type { StatusTone } from "@onn/ui/components/status-pill";

export const CONTENT_TONE: Record<ContentStatus, StatusTone> = {
  draft: "neutral",
  published: "positive",
  changed: "warning",
};

export const SIGNATURE_TONE: Record<SignatureStatus, StatusTone> = {
  pending: "info",
  signed: "positive",
  failed: "negative",
};

/** Palette order: the most used first. */
export const WIDGET_TYPES: Widget["type"][] = [
  "kpi",
  "line",
  "bar",
  "stacked",
  "donut",
  "map",
  "table",
  "target",
  "radar",
  "treemap",
  "text",
];
/** How many indicators each widget type plots (the others use the first). */
export const WIDGET_MAX_INDICATORS: Partial<Record<Widget["type"], number>> = { line: 4, table: 4 };
/** Widget types that split one indicator by a breakdown. */
export const WIDGET_BREAKDOWN: Widget["type"][] = ["bar", "stacked", "donut", "treemap"];

export const BLOCK_TYPES: ReportBlock["type"][] = ["text", "kpis", "chart", "map", "table"];
export const BLOCK_MAX_INDICATORS = { kpis: 6, table: 4 } as const;

export const AUDIENCES = ["decision", "analyst", "public"] as const;
export const PUBLICATION_TYPES: PublicationRecord["type"][] = [
  "quarterly",
  "annual",
  "study",
  "method",
];

/** Periods the server checks by type; other types take free text. */
export const PERIOD_PATTERN: Partial<Record<string, RegExp>> = {
  quarterly: /^\d{4}-Q[1-4]$/,
  annual: /^\d{4}$/,
};

/**
 * The public portal's address for previews and "view on site" links. Unset in production means
 * the same origin (the portal serves /admin as a zone); in development the admin runs on its own
 * port, so it falls back to the portal's dev server, as in .env.example.
 */
const PORTAL_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "")
).replace(/\/$/, "");

export function portalUrl(path: string) {
  return `${PORTAL_ORIGIN}${path}`;
}

/** Lowercase ASCII words joined by hyphens, as the server's slug rule wants. */
export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** A short id unique among `taken`. */
export function newId(prefix: string, taken: string[]) {
  let n = taken.length + 1;
  while (taken.includes(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}
