import type { Indicator, Publication } from "@onn/api-client/types";
import { describe, expect, it } from "vitest";
import { allPages, datasetJsonLd, licenceUrl, reportJsonLd, serialiseJsonLd } from "./seo";

const indicator = {
  code: "CONN.4G_POP",
  name: "4G coverage",
  shortDefinition: "Short",
  definition: "Share of the population covered by 4G.",
  synonyms: ["LTE"],
  licence: "CC BY 4.0",
  coverage: { from: "2015", to: "2025", areas: 60 },
  lastUpdated: "2026-03-01",
  source: { org: "Regulator", method: "administrative" },
} as unknown as Indicator;

const publication = {
  slug: "q1-2026",
  title: "Quarterly report",
  summary: "Summary",
  date: "2026-04-15",
  fileUrl: "/files/q1.pdf",
  fallback: true,
} as unknown as Publication;

describe("seo", () => {
  it("maps known licences to URLs and keeps unknown names", () => {
    expect(licenceUrl("CC BY 4.0")).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(licenceUrl("Custom")).toBe("Custom");
  });

  it("collects every page and stops at the total", async () => {
    const calls: number[] = [];
    const items = await allPages(async (page) => {
      calls.push(page);
      return { items: page < 3 ? [page, page] : [page], meta: { total: 5, page, pageSize: 2 } };
    });
    expect(items).toEqual([1, 1, 2, 2, 3]);
    expect(calls).toEqual([1, 2, 3]);
  });

  it("builds a Dataset with coverage, licence and a CSV download", () => {
    const data = datasetJsonLd(indicator, "en", "https://onn.example");
    expect(data["@type"]).toBe("Dataset");
    expect(data.url).toBe("https://onn.example/en/data/CONN.4G_POP");
    expect(data.temporalCoverage).toBe("2015/2025");
    expect(data.license).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(data.distribution[0]!.contentUrl).toBe(
      "https://onn.example/api/v1/data?indicator=CONN.4G_POP&format=csv",
    );
  });

  it("builds a Report with an absolute PDF and the fallback language", () => {
    const data = reportJsonLd(publication, "en", "https://onn.example");
    expect(data["@type"]).toBe("Report");
    expect(data.encoding.contentUrl).toBe("https://onn.example/files/q1.pdf");
    expect(data.inLanguage).not.toBe("en");
  });

  it("escapes < so text can't close the script element", () => {
    expect(serialiseJsonLd({ name: "</script><b>" })).not.toContain("<");
  });
});
