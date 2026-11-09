import { country } from "@onn/config";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("tagFor", () => {
  it("uses the configured tag for each enabled locale", async () => {
    const { tagFor } = await import("./format");
    for (const locale of country.locales.enabled) {
      expect(tagFor(locale)).toBe(country.numberFormat[locale] ?? locale);
    }
  });

  it("falls back to the default locale's tag when Intl lacks the configured one", async () => {
    const [first] = country.locales.enabled.filter((l) => l !== country.locales.default);
    const configured = country.numberFormat[first!]!;
    const real = Intl.NumberFormat.supportedLocalesOf;
    vi.spyOn(Intl.NumberFormat, "supportedLocalesOf").mockImplementation((tags, options) =>
      [tags].flat().includes(configured) || [tags].flat().includes(first!)
        ? []
        : real(tags, options),
    );
    const { tagFor } = await import("./format");
    const expected = country.numberFormat[country.locales.default] ?? country.locales.default;
    // Only meaningful when the locale doesn't already share the default's tag.
    if (configured !== expected) expect(tagFor(first!)).toBe(expected);
  });

  it("ends at en for an unknown, unsupported locale", async () => {
    vi.spyOn(Intl.NumberFormat, "supportedLocalesOf").mockReturnValue([]);
    const { tagFor } = await import("./format");
    expect(tagFor("xx")).toBe("en");
  });

  it("formats dates in the fallback for Wolof-style locales", async () => {
    const { formatDate } = await import("./format");
    for (const locale of country.locales.enabled) {
      expect(formatDate("2026-01-15T12:00:00Z", locale)).toMatch(/2026/);
    }
  });
});
