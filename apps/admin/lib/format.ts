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
