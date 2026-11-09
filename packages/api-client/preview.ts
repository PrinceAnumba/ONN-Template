// Draft widgets travel to the portal's preview embed in the URL (`/embed/preview?d=`), so the back
// office previews with the portal's own components without the draft being public. Shared so
// both sides agree on the format; the portal treats what it decodes as untrusted input.
import type { Widget } from "./types";

export const PREVIEW_MAX_WIDGETS = 24;
/** Longer URLs risk being cut by proxies; the builder previews one widget at a time past it. */
export const PREVIEW_MAX_LENGTH = 7000;

const TYPES: Widget["type"][] = [
  "kpi",
  "line",
  "bar",
  "stacked",
  "donut",
  "radar",
  "treemap",
  "map",
  "table",
  "target",
  "text",
];
const CODE = /^[A-Za-z0-9_.:-]{1,64}$/;
const YEARS = /^\d{4}(?:-\d{4})?$/;

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** Drops empty optional fields so URLs stay short. */
export function encodePreview(widgets: Widget[]) {
  const compact = widgets.map((widget) => {
    const out: Record<string, unknown> = {
      id: widget.id,
      type: widget.type,
      title: widget.title,
      indicators: widget.indicators,
      span: widget.span,
    };
    for (const key of ["area", "compare", "years", "body"] as const) {
      if (widget[key]) out[key] = widget[key];
    }
    if (widget.dims && Object.keys(widget.dims).length) out.dims = widget.dims;
    return out;
  });
  return toBase64Url(JSON.stringify(compact));
}

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.slice(0, max) : "";

/** The widgets in a preview parameter, or null when it isn't one. Unknown fields are dropped. */
export function decodePreview(param: string | null | undefined): Widget[] | null {
  if (!param || param.length > PREVIEW_MAX_LENGTH * 2) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(param));
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const widgets: Widget[] = [];
  for (const [index, item] of raw.slice(0, PREVIEW_MAX_WIDGETS).entries()) {
    if (!item || typeof item !== "object") return null;
    const value = item as Record<string, unknown>;
    if (!TYPES.includes(value.type as Widget["type"])) return null;
    const indicators = Array.isArray(value.indicators)
      ? value.indicators.filter(
          (code): code is string => typeof code === "string" && CODE.test(code),
        )
      : [];
    const span = [1, 2, 3].includes(Number(value.span)) ? (Number(value.span) as 1 | 2 | 3) : 1;
    const widget: Widget = {
      id: CODE.test(String(value.id)) ? String(value.id) : `w${index}`,
      type: value.type as Widget["type"],
      title: text(value.title, 200),
      indicators: indicators.slice(0, 4),
      span,
    };
    if (typeof value.area === "string" && CODE.test(value.area)) widget.area = value.area;
    if (typeof value.compare === "string" && CODE.test(value.compare))
      widget.compare = value.compare;
    if (typeof value.years === "string" && YEARS.test(value.years)) widget.years = value.years;
    if (typeof value.body === "string") widget.body = text(value.body, 4000);
    if (value.dims && typeof value.dims === "object") {
      const dims = Object.entries(value.dims as Record<string, unknown>).filter(
        ([key, dim]) => CODE.test(key) && typeof dim === "string" && /^[\w*-]{1,40}$/.test(dim),
      );
      if (dims.length) widget.dims = Object.fromEntries(dims) as Record<string, string>;
    }
    widgets.push(widget);
  }
  return widgets;
}
