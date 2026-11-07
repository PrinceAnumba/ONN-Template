import type {
  Area,
  Benchmark,
  Indicator,
  IndicatorSummary,
  Observation,
  Page,
  Pillar,
  Problem,
  Series,
} from "@onn/api-client/types";
import SEN from "@onn/config/countries/SEN";
import TGO from "@onn/config/countries/TGO";
import { getResponse } from "msw";
import { describe, expect, it } from "vitest";
import { generateFixtures } from "./fixtures";
import { createHandlers } from "./handlers";

const fixtures = generateFixtures(SEN, 42);
const handlers = createHandlers(fixtures, { latency: [0, 0] });

async function call(path: string, locale = "fr", init: RequestInit = {}) {
  const request = new Request(`http://mock/api/v1${path}`, {
    ...init,
    headers: { "Accept-Language": locale, ...init.headers },
  });
  const response = await getResponse(handlers, request);
  if (!response) throw new Error(`Unhandled: ${path}`);
  return response;
}
async function get<T>(path: string, locale = "fr") {
  const response = await call(path, locale);
  expect(response.status, path).toBe(200);
  return (await response.json()) as T;
}

describe("fixture generator", () => {
  it("is deterministic for a seed", () => {
    expect(JSON.stringify(generateFixtures(SEN, 42))).toBe(JSON.stringify(fixtures));
  });

  it("varies with the seed", () => {
    expect(JSON.stringify(generateFixtures(SEN, 7).observations)).not.toBe(
      JSON.stringify(fixtures.observations),
    );
  });

  it("has at least 40 indicators across 8 pillars", () => {
    expect(fixtures.indicators.length).toBeGreaterThanOrEqual(40);
    expect(fixtures.pillars).toHaveLength(8);
    for (const pillar of fixtures.pillars) {
      expect(fixtures.indicators.some((item) => item.pillar === pillar.code)).toBe(true);
    }
  });

  it("covers 2015–2025 at national, adm1 and adm2 with dims", () => {
    const rows = fixtures.observations;
    expect(rows.some((row) => row.period === "2015")).toBe(true);
    expect(rows.some((row) => row.period === "2025")).toBe(true);
    const levels = new Set(
      rows.map((row) => fixtures.areas.find((area) => area.code === row.area)?.level),
    );
    expect(levels).toEqual(new Set(["country", "adm1", "adm2"]));
    for (const key of ["sex", "age_group", "area"]) {
      expect(rows.some((row) => key in row.dims)).toBe(true);
    }
  });

  it("includes E, P and B flags and some gaps", () => {
    const statuses = new Set(fixtures.observations.map((row) => row.status));
    for (const status of ["A", "E", "P", "B", "M"] as const) expect(statuses).toContain(status);
    expect(fixtures.observations.some((row) => row.value === null)).toBe(true);
  });

  it("keeps percentages in range", () => {
    for (const row of fixtures.observations) {
      if (row.unit === "%" && row.value !== null) {
        expect(row.value).toBeGreaterThanOrEqual(0);
        expect(row.value).toBeLessThanOrEqual(100);
      }
    }
  });

  it("gives monotonic national trends", () => {
    for (const seed of fixtures.indicators) {
      const values = fixtures.observations
        .filter(
          (row) =>
            row.indicator === seed.code &&
            row.area === "SEN" &&
            Object.keys(row.dims).length === 0 &&
            row.value !== null,
        )
        .map((row) => row.value as number);
      if (values.length < 2) continue;
      const rising = (values.at(-1) as number) >= (values[0] as number);
      values.slice(1).forEach((value, i) => {
        const previous = values[i] as number;
        expect(rising ? value >= previous : value <= previous, seed.code as string).toBe(true);
      });
    }
  });

  it("builds for another country with its own config", () => {
    const togo = generateFixtures(TGO, 42);
    expect(togo.areas[0]?.code).toBe("TGO");
    expect(togo.meta.locales).toEqual(["fr", "en"]);
    expect(Object.keys(togo.geo)).toEqual(["adm1", "adm2"]);
  });
});

describe("portal endpoints", () => {
  it("GET /pillars", async () => {
    const pillars = await get<Pillar[]>("/pillars", "en");
    expect(pillars[0]?.name).toBe("Connectivity and infrastructure");
    expect(pillars[0]?.indicatorCount).toBeGreaterThan(0);
    expect(pillars[0]?.themes[0]?.indicatorCount).toBeGreaterThan(0);
  });

  it("GET /indicators filters and paginates", async () => {
    const page = await get<Page<IndicatorSummary>>("/indicators?pillar=CONN&pageSize=2");
    expect(page.items).toHaveLength(2);
    expect(page.meta.total).toBeGreaterThan(2);
    const headline = await get<Page<IndicatorSummary>>("/indicators?headline=true");
    expect(headline.items.every((item) => item.isHeadline)).toBe(true);
    const search = await get<Page<IndicatorSummary>>("/indicators?q=LTE");
    expect(search.items[0]?.code).toBe("CONN.4G_POP");
  });

  it("gives summaries latest values with a sparkline", async () => {
    const page = await get<Page<IndicatorSummary>>("/indicators?headline=true");
    const latest = page.items[0]?.latest;
    expect(latest?.sparkline.length).toBe(10);
    expect(latest?.sparkline.at(-1)).toBe(latest?.value);
  });

  it("omits latest for planned indicators", async () => {
    const page = await get<Page<IndicatorSummary>>("/indicators?status=planned");
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items[0]?.latest).toBeUndefined();
  });

  it("GET /indicators/{code}", async () => {
    const indicator = await get<Indicator>("/indicators/CONN.4G_POP", "en");
    expect(indicator.name).toBe("4G population coverage");
    expect(indicator.related.length).toBeGreaterThan(0);
    expect(indicator.dashboards[0]?.title).toBe("Decision-makers dashboard");
  });

  it("returns a Problem for an unknown indicator", async () => {
    const response = await call("/indicators/NOPE");
    expect(response.status).toBe(404);
    expect(((await response.json()) as Problem).status).toBe(404);
  });

  it("GET /areas", async () => {
    const regions = await get<Area[]>("/areas?level=adm1");
    expect(regions).toHaveLength(14);
    const children = await get<Area[]>(`/areas?parent=${regions[0]?.code}`);
    expect(children.every((area) => area.level === "adm2")).toBe(true);
    const [country] = await get<Area[]>("/areas?level=country", "en");
    expect(country?.name).toBe("Senegal");
    const groups = await get<Area[]>("/areas?level=group", "en");
    expect(groups.map((area) => area.code)).toContain("peer:ECOWAS");
    const search = await get<Area[]>("/areas?q=dakar");
    expect(search[0]?.name).toBe("Dakar");
  });

  it("GET /areas/{code}/geometry returns one shape per area", async () => {
    const topology = await get<{ objects: { areas: { geometries: unknown[] } } }>(
      "/areas/SEN/geometry?level=adm1",
    );
    expect(topology.objects.areas.geometries).toHaveLength(14);
  });

  it("GET /series for a total, a filtered range and categories", async () => {
    const [total] = await get<Series[]>(
      "/series?indicator=ACCESS.INTERNET_USERS&area=SEN&years=2020-2025",
    );
    expect(total?.points.map((p) => p.period)).toEqual([
      "2020",
      "2021",
      "2022",
      "2023",
      "2024",
      "2025",
    ]);
    const sex = await get<Series[]>("/series?indicator=ACCESS.INTERNET_USERS&area=SEN&dims=sex:*");
    expect(sex.map((s) => s.dims.sex).sort()).toEqual(["female", "male"]);
  });

  it("GET /series for a peer economy and a peer group", async () => {
    const [peer] = await get<Series[]>("/series?indicator=ACCESS.INTERNET_USERS&area=GHA");
    expect(peer?.points).toHaveLength(11);
    const [group] = await get<Series[]>("/series?indicator=ACCESS.INTERNET_USERS&area=peer:ECOWAS");
    expect(group?.area).toBe("peer:ECOWAS");
    expect(group?.points.every((p) => typeof p.value === "number")).toBe(true);
  });

  it("applies a unit variant", async () => {
    const [base] = await get<Series[]>("/series?indicator=ACCESS.INTERNET_USERS&area=SEN");
    const [people] = await get<Series[]>(
      "/series?indicator=ACCESS.INTERNET_USERS&area=SEN&unit=people",
    );
    const value = base?.points.find((p) => p.value !== null);
    const same = people?.points.find((p) => p.period === value?.period);
    expect(same?.value).toBeCloseTo((value?.value as number) * 170_000, 0);
    expect(people?.unit).toBe("personnes");
  });

  it("GET /data for a level, with pagination", async () => {
    const page = await get<Page<Observation>>(
      "/data?indicator=CONN.4G_POP&level=adm1&year=2024&pageSize=500",
    );
    expect(page.meta.total).toBe(14);
  });

  it("GET /data matches the row count of several indicators and areas", async () => {
    const page = await get<Page<Observation>>(
      "/data?indicator=CONN.4G_POP,CONN.3G_POP&area=SEN,SN-01&year=2018-2025",
    );
    expect(page.meta.total).toBe(2 * 2 * 8);
  });

  it("GET /data as CSV", async () => {
    const response = await call("/data?indicator=CONN.4G_POP&area=SEN&format=csv");
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect((await response.text()).trim().split("\n")).toHaveLength(12);
  });

  it("GET /data/latest skips gaps and finds a whole level", async () => {
    const rows = await get<Observation[]>("/data/latest?indicator=CONN.4G_POP&level=adm1");
    expect(rows).toHaveLength(14);
    expect(rows.every((row) => row.value !== null)).toBe(true);
  });

  it("GET /benchmark", async () => {
    const result = await get<Benchmark>(
      "/benchmark?indicator=ACCESS.INTERNET_USERS&group=ECOWAS",
      "en",
    );
    expect(result.rows).toHaveLength(13);
    expect(result.rows.map((row) => row.rank)).toEqual(result.rows.map((_, i) => i + 1));
    expect(result.rows.some((row) => row.name === "Senegal")).toBe(true);
    expect(result.stats.length).toBe(11);
    const years = new Set(result.history.map((row) => row.year));
    expect(years.size).toBe(5);
  });

  it("ranks lower-is-better indicators the right way round", async () => {
    const { rows } = await get<Benchmark>("/benchmark?indicator=AFFORD.DATA_2GB&group=ECOWAS");
    expect(rows[0]?.value as number).toBeLessThan(rows.at(-1)?.value as number);
  });

  it.each([
    "/index",
    "/index?year=2020",
    "/targets",
    "/dashboards",
    "/dashboards/analysts",
    "/publications?type=annual",
    "/news?kind=watch",
    "/home",
    "/pages/about",
    "/datasets",
  ])("GET %s", async (path) => {
    await get(path);
  });

  it("lists publications newest first", async () => {
    const page = await get<Page<{ date: string }>>("/publications");
    const dates = page.items.map((item) => item.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("resolves publication and news detail from their lists", async () => {
    const publications = await get<Page<{ slug: string; fileUrl: string }>>("/publications");
    const publication = publications.items[0];
    await get(`/publications/${publication?.slug}`);
    expect((await call(publication?.fileUrl.replace("/api/v1", "") as string)).status).toBe(200);
    const news = await get<Page<{ slug: string }>>("/news");
    await get(`/news/${news.items[0]?.slug}`);
  });

  it("POST /feedback and /api-keys", async () => {
    for (const path of ["/feedback", "/api-keys"]) {
      const response = await call(path, "fr", { method: "POST", body: "{}" });
      expect(response.status).toBe(201);
    }
  });

  it("POST /subscribers validates the email", async () => {
    const bad = await call("/subscribers", "fr", { method: "POST", body: "{}" });
    expect(bad.status).toBe(422);
    expect(((await bad.json()) as Problem).errors?.[0]?.path).toBe("email");
    const good = await call("/subscribers", "fr", {
      method: "POST",
      body: JSON.stringify({ email: "a@example.org" }),
    });
    expect(good.status).toBe(201);
  });

  it("runs an export job to completion", async () => {
    const created = await call("/exports", "fr", { method: "POST", body: "{}" });
    const { jobId } = (await created.json()) as { jobId: string };
    expect((await get<{ status: string }>(`/exports/${jobId}`)).status).toBe("running");
    const done = await get<{ status: string; url: string }>(`/exports/${jobId}`);
    expect(done.status).toBe("done");
    expect((await call(done.url.replace("/api/v1", ""))).status).toBe(200);
  });
});

describe("mock behaviour", () => {
  it("?_fail=1 forces an error on any route", async () => {
    for (const path of ["/pillars?_fail=1", "/home?_fail=1"]) {
      expect((await call(path)).status).toBe(500);
    }
    const post = await call("/feedback?_fail=1", "fr", { method: "POST", body: "{}" });
    expect(post.status).toBe(500);
  });

  it("falls back to the default locale and flags it", async () => {
    const indicator = await get<Indicator>("/indicators/CONN.4G_POP", "wo");
    expect(indicator.name).toBe("Couverture 4G de la population");
    expect(indicator.fallback).toBe(true);
    const english = await get<Indicator>("/indicators/CONN.4G_POP", "en");
    expect(english.fallback).toBeUndefined();
  });

  it("uses the default locale for an unknown language", async () => {
    const indicator = await get<Indicator>("/indicators/CONN.4G_POP", "de");
    expect(indicator.name).toBe("Couverture 4G de la population");
  });

  it("adds latency within the requested range", async () => {
    const slow = createHandlers(fixtures, { latency: [40, 60] });
    const start = performance.now();
    await getResponse(slow, new Request("http://mock/api/v1/home"));
    expect(performance.now() - start).toBeGreaterThanOrEqual(35);
  });
});
