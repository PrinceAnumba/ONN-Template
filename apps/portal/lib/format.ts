import { country } from "@onn/config";

/** BCP 47 tag for Intl, through the configured fallback (e.g. wo → fr-SN). */
export function tagFor(locale: string) {
  return country.numberFormat[locale] ?? locale;
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
