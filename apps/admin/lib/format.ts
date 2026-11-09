import { country } from "@onn/config";
import { tagFor } from "@onn/config/locale";

export function formatDate(value: string, locale: string, style: "long" | "medium" = "long") {
  return new Intl.DateTimeFormat(tagFor(locale), {
    dateStyle: style,
    timeZone: country.timezone,
  }).format(new Date(value));
}

export function formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(tagFor(locale), options).format(value);
}

export function formatBytes(bytes: number, locale: string) {
  const megabytes = bytes / 1_000_000;
  return new Intl.NumberFormat(tagFor(locale), {
    style: "unit",
    unit: megabytes >= 1 ? "megabyte" : "kilobyte",
    maximumFractionDigits: 1,
  }).format(megabytes >= 1 ? megabytes : Math.max(0.1, bytes / 1000));
}

export function formatTime(value: string | Date, locale: string) {
  return new Intl.DateTimeFormat(tagFor(locale), {
    timeStyle: "short",
    timeZone: country.timezone,
  }).format(new Date(value));
}
