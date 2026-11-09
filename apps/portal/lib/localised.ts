import { country } from "@onn/config";

/** Picks a config text in the page language, falling back to the default locale's text. */
export function pick(text: Record<string, string>, locale: string) {
  return text[locale] ?? text[country.locales.default] ?? Object.values(text)[0] ?? "";
}

/**
 * The language of API content that fell back to the default locale (`fallback: true`), for its
 * `lang` attribute, so screen readers read it with the right voice. Undefined otherwise.
 */
export function fallbackLang(item: { fallback?: boolean }) {
  return item.fallback ? country.locales.default : undefined;
}
