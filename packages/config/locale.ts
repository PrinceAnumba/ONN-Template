// Locale tags for Intl, shared by both apps.
import { country } from "./country.config";

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
