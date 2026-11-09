import { country } from "@onn/config";

function supported(tag: string) {
  try {
    return (
      Intl.NumberFormat.supportedLocalesOf([tag]).length > 0 &&
      Intl.DateTimeFormat.supportedLocalesOf([tag]).length > 0
    );
  } catch {
    return false; // malformed tag
  }
}

const tags = new Map<string, string>();

/**
 * BCP 47 tag for Intl (spec decision: a tested fallback, because Intl data for languages such
 * as Wolof may be missing). Tries the configured tag (wo → fr-SN), the locale itself, then the
 * default locale's tag, and ends at "en", using the first the runtime actually supports.
 */
export function tagFor(locale: string) {
  const known = tags.get(locale);
  if (known) return known;
  const fallback = country.locales.default;
  const tag =
    [country.numberFormat[locale], locale, country.numberFormat[fallback], fallback].find(
      (candidate): candidate is string => Boolean(candidate) && supported(candidate as string),
    ) ?? "en";
  tags.set(locale, tag);
  return tag;
}

export function formatDate(value: string, locale: string, style: "long" | "medium" = "long") {
  return new Intl.DateTimeFormat(tagFor(locale), {
    dateStyle: style,
    timeZone: country.timezone,
  }).format(new Date(value));
}

export function formatBytes(bytes: number, locale: string) {
  const megabytes = bytes / 1_000_000;
  return new Intl.NumberFormat(tagFor(locale), {
    style: "unit",
    unit: megabytes >= 1 ? "megabyte" : "kilobyte",
    maximumFractionDigits: 1,
  }).format(megabytes >= 1 ? megabytes : bytes / 1000);
}

/** Year of a period such as "2025" or "2025-Q3", as a number for trend fitting. */
export function periodYear(period: string) {
  const [year, quarter] = period.split("-Q");
  return Number(year) + (quarter ? (Number(quarter) - 1) / 4 : 0);
}
