/** Picks a config text in the page language, falling back to the default locale's text. */
export function pick(text: Record<string, string>, locale: string) {
  return text[locale] ?? text.fr ?? Object.values(text)[0] ?? "";
}
