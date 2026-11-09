import { describe, expect, it } from "vitest";
import { decodePreview, encodePreview } from "./preview";

describe("preview parameter", () => {
  it("round-trips widgets, including non-Latin text", () => {
    const widgets = [
      {
        id: "a",
        type: "line" as const,
        title: "Couverture 4G — régions",
        indicators: ["CONN.4G_POP"],
        span: 2 as const,
        compare: "peer:ECOWAS",
        years: "2019-2024",
      },
      {
        id: "t",
        type: "text" as const,
        title: "نص",
        indicators: [],
        span: 3 as const,
        body: "**ok**",
      },
    ];
    expect(decodePreview(encodePreview(widgets))).toEqual(widgets);
  });

  it("rejects malformed input and drops unsafe fields", () => {
    expect(decodePreview("not base64 json")).toBeNull();
    expect(decodePreview(encodePreview([]))).toBeNull();
    const bad = btoa(JSON.stringify([{ type: "script", title: "x" }]));
    expect(decodePreview(bad)).toBeNull();
    const odd = btoa(
      JSON.stringify([
        { id: "<x>", type: "kpi", title: 5, indicators: ["A.B", "<img>"], span: 9, years: "soon" },
      ]),
    );
    expect(decodePreview(odd)).toEqual([
      { id: "w0", type: "kpi", title: "", indicators: ["A.B"], span: 1 },
    ]);
  });
});
