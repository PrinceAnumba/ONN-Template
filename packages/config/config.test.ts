import { wcagContrast } from "culori";
import { describe, expect, it } from "vitest";
import SEN from "./countries/SEN";
import TGO from "./countries/TGO";
import { countrySchema, type CountryConfig } from "./schema";
import { deriveInk, renderTokensCss, sequentialScale } from "./tokens";

const clone = (config: CountryConfig) => structuredClone(config);

describe("countrySchema", () => {
  it.each([
    ["SEN", SEN],
    ["TGO", TGO],
  ])("accepts %s", (_, config) => {
    expect(countrySchema.safeParse(config).success).toBe(true);
  });

  it("rejects a missing key", () => {
    const config: Partial<CountryConfig> = clone(SEN);
    delete config.observatory;
    expect(countrySchema.safeParse(config).success).toBe(false);
  });

  it("rejects an unknown key", () => {
    expect(countrySchema.safeParse({ ...clone(SEN), extra: true }).success).toBe(false);
  });

  it("rejects text missing for an enabled locale", () => {
    const config = clone(SEN);
    delete config.name.wo;
    const result = countrySchema.safeParse(config);
    expect(result.error?.issues[0]?.path).toEqual(["name", "wo"]);
  });

  it("rejects a default locale that is not enabled", () => {
    const config = clone(SEN);
    config.locales.default = "de";
    expect(countrySchema.safeParse(config).success).toBe(false);
  });

  it("rejects a default peer group that does not exist", () => {
    const config = clone(SEN);
    config.peers.default = "NOPE";
    expect(countrySchema.safeParse(config).success).toBe(false);
  });

  it("rejects an invalid timezone", () => {
    const config = clone(SEN);
    config.timezone = "Africa/Nowhere";
    expect(countrySchema.safeParse(config).success).toBe(false);
  });
});

describe("deriveInk", () => {
  it("keeps a colour that already passes", () => {
    expect(deriveInk("#00853F")).toEqual({ ink: "#00853F", adjusted: false });
  });

  it.each(["#FFCC00", "#56B4E9", "#E69F00", "#FF0000", "#F0E442"])(
    "darkens %s to at least 4.5:1 on white",
    (color) => {
      const { ink, adjusted } = deriveInk(color);
      expect(adjusted).toBe(true);
      expect(wcagContrast(ink, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("stops as soon as it passes rather than going to black", () => {
    expect(wcagContrast(deriveInk("#FFCC00").ink, "#FFFFFF")).toBeLessThan(4.7);
  });
});

describe("renderTokensCss", () => {
  it("reports when the ink was adjusted", () => {
    const { inkAdjusted } = renderTokensCss({ ...SEN.brand, primary: "#FFCC00" });
    expect(inkAdjusted).toBe(true);
  });

  it("emits the spec spacing scale", () => {
    const { css } = renderTokensCss(SEN.brand);
    expect(css).toContain("--s-1: 4px;");
    expect(css).toContain("--s-8: 64px;");
  });
});

describe("sequentialScale", () => {
  it("runs five steps from surface-2 to the ink", () => {
    const scale = sequentialScale("#00853F");
    expect(scale).toHaveLength(5);
    expect(scale[0]).toBe("#F5F7FA");
    expect(scale[4]).toBe("#00853F");
  });
});
