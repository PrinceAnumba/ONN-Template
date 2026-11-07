import { chartTokens } from "@onn/config/tokens";
import { describe, expect, it } from "vitest";
import { choropleth, classIndex, classify } from "./classify";
import { barIsHorizontal, buildOption, donutSlices, startsAtZero } from "./options";
import type { BarSpec, DonutSpec, LineSpec } from "./spec";
import { renderChartSvg } from "./ssr";
import { geoArea } from "d3-geo";
import topology from "../mocks/fixtures/SEN/geo/adm1.topo.json";
import { toFeatures } from "./choropleth-svg";
import { chartTable, tableToCsv } from "./table";

const ctx = { tokens: chartTokens, animate: false };
const line: LineSpec = {
  kind: "line",
  tag: "en-SN",
  unitKind: "pct",
  series: [
    {
      name: "Senegal",
      role: "focus",
      points: [
        { period: "2023", value: 50, status: "A" },
        { period: "2024", value: 55, status: "B" },
        { period: "2025", value: 60, status: "P" },
      ],
    },
    { name: "ECOWAS", role: "compare", points: [{ period: "2024", value: 40 }] },
  ],
  band: { name: "ECOWAS", points: [{ period: "2024", min: 20, max: 70 }] },
  labels: {
    period: "Year",
    breakInSeries: "Break in series",
    range: "range",
    status: { P: "Provisional" },
  },
};

type AnySeries = Record<string, unknown> & { data: unknown[] };

describe("line option", () => {
  const option = buildOption(line, ctx);
  const series = option.series as AnySeries[];
  const focus = series.find((s) => s.name === "Senegal" && !s.id) as AnySeries;

  it("uses solid primary 2.5 px for the focus and dashed grey for the comparison", () => {
    expect(focus.lineStyle).toMatchObject({
      width: 2.5,
      type: "solid",
      color: chartTokens.primary,
    });
    const compare = series.find((s) => s.name === "ECOWAS" && !s.id) as AnySeries;
    expect(compare.lineStyle).toMatchObject({ type: "dashed", color: chartTokens.compare });
  });

  it("marks the last point, hollow dots for provisional points and a rule for breaks", () => {
    const points = focus.data as { symbol: string }[];
    expect(points[2]?.symbol).toBe("emptyCircle");
    expect(points[0]?.symbol).toBe("none");
    expect((focus.markLine as { data: unknown[] }).data).toEqual([{ xAxis: "2024" }]);
  });

  it("draws the peer band as a stacked range", () => {
    expect(series.map((s) => s.id).filter(Boolean)).toEqual(["band-min", "band-range"]);
  });

  it("labels series ends instead of a legend for up to four series", () => {
    expect((option.legend as { show: boolean }).show).toBe(false);
    expect((focus.endLabel as { show: boolean }).show).toBe(true);
  });

  it("starts the y axis at zero for percentages", () => {
    expect((option.yAxis as { min?: number }).min).toBe(0);
  });
});

describe("startsAtZero", () => {
  it("starts at zero for counts and percentages", () => {
    expect(startsAtZero("count", [10, 100])).toBe(true);
  });

  it("does not when the range is under 10 % of the maximum", () => {
    expect(startsAtZero("pct", [95, 98])).toBe(false);
  });

  it("does not for scores", () => {
    expect(startsAtZero("score", [10, 100])).toBe(false);
  });
});

describe("bars and donuts", () => {
  const bars: BarSpec = {
    kind: "bar",
    tag: "en-SN",
    unitKind: "pct",
    items: [
      { label: "A", value: 80, focus: true },
      { label: "B", value: 2 },
    ],
    labels: { category: "Economy", value: "Value", median: "Median" },
  };

  it("goes horizontal for long labels or more than 8 items", () => {
    expect(barIsHorizontal(bars)).toBe(false);
    expect(
      barIsHorizontal({ ...bars, items: [{ label: "A very long economy name", value: 1 }] }),
    ).toBe(true);
    expect(
      barIsHorizontal({
        ...bars,
        items: Array.from({ length: 9 }, (_, i) => ({ label: `${i}`, value: i })),
      }),
    ).toBe(true);
  });

  it("puts value labels outside bars too short to hold them", () => {
    const data = (buildOption(bars, ctx).series as AnySeries[])[0]!.data as {
      label: { position: string };
    }[];
    expect(data[0]?.label.position).toBe("insideTop");
    expect(data[1]?.label.position).toBe("top");
  });

  it("groups slices past five into Other", () => {
    const donut: DonutSpec = {
      kind: "donut",
      tag: "en-SN",
      unitKind: "count",
      items: Array.from({ length: 8 }, (_, i) => ({ label: `S${i}`, value: 10 - i })),
      labels: { other: "Other", total: "Total", category: "Operator", value: "Subscriptions" },
    };
    const slices = donutSlices(donut);
    expect(slices).toHaveLength(6);
    expect(slices[5]).toEqual({ label: "Other", value: 5 + 4 + 3 });
  });
});

describe("table and CSV", () => {
  it("holds exactly the plotted values", () => {
    const table = chartTable(line);
    expect(table.columns).toEqual(["Year", "Senegal", "ECOWAS", "ECOWAS min", "ECOWAS max"]);
    expect(table.rows[1]).toEqual(["2024", 55, 40, 20, 70]);
    expect(tableToCsv(table).split("\n")[2]).toBe("2024,55,40,20,70");
  });

  it("escapes commas and quotes", () => {
    expect(tableToCsv({ columns: ['a,"b"'], rows: [], numeric: [false] })).toBe('"a,""b"""');
  });
});

describe("server rendering", () => {
  it("renders a responsive SVG", () => {
    const svg = renderChartSvg(line, { width: 800, height: 420 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('width="100%"');
    expect(svg).toContain("viewBox");
    expect(svg).toContain("Break in series");
  });
});

describe("classification", () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 50, 100];

  it("produces six edges from minimum to maximum", () => {
    for (const method of ["quantile", "equal", "jenks"] as const) {
      const edges = classify(values, method);
      expect(edges).toHaveLength(6);
      expect(edges[0]).toBe(1);
      expect(edges[5]).toBe(100);
    }
  });

  it("spaces equal intervals evenly", () => {
    expect(classify([0, 100], "equal")).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it("finds natural breaks around clusters", () => {
    const clusters = [1, 2, 3, 50, 51, 52, 100, 101, 102];
    const edges = classify(clusters, "jenks", 3);
    expect(clusters.map((value) => classIndex(value, edges))).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
  });

  it("gives an outlier its own natural class", () => {
    const edges = classify([1, 2, 3, 20, 21, 22, 50, 51, 90, 91, 92, 200], "jenks", 3);
    expect(classIndex(200, edges)).toBe(2);
    expect(classIndex(92, edges)).toBe(1);
  });

  it("puts the maximum in the last class and missing values nowhere", () => {
    const edges = classify(values, "quantile");
    expect(classIndex(100, edges)).toBe(4);
    expect(classIndex(null, edges)).toBe(-1);
  });

  it("counts areas per class and no-data areas", () => {
    const { fills, classes, noData } = choropleth(
      { A: 1, B: 50, C: null, D: 100, E: 10, F: 5 },
      "quantile",
      chartTokens.sequential,
    );
    expect(fills.C).toBeNull();
    expect(noData).toBe(1);
    expect(classes.reduce((sum, item) => sum + item.count, 0)).toBe(5);
    expect(fills.D).toBe(chartTokens.sequential[4]);
  });
});

describe("map geometry", () => {
  it("rewinds inside-out polygons so each region covers only itself", () => {
    for (const area of toFeatures(topology).features) {
      expect(geoArea(area)).toBeLessThan(0.01);
    }
  });
});
