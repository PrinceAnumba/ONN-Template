import { describe, expect, it } from "vitest";
import { describeCron, nextCronRun, parseCron } from "./cron";

describe("parseCron", () => {
  it("expands lists, ranges and steps", () => {
    expect(parseCron("0 6 * * 1")).toEqual([[0], [6], expect.any(Array), expect.any(Array), [1]]);
    expect(parseCron("*/15 8-10 1,15 * *")?.slice(0, 3)).toEqual([
      [0, 15, 30, 45],
      [8, 9, 10],
      [1, 15],
    ]);
    expect(parseCron("0 0 * * 7")?.[4]).toEqual([0]);
  });

  it("refuses malformed or out-of-range fields", () => {
    for (const bad of [
      "",
      "0 6 * *",
      "60 6 * * *",
      "0 24 * * *",
      "0 6 0 * *",
      "0 6 * 13 *",
      "a b c d e",
      "5-1 * * * *",
      "*/0 * * * *",
    ]) {
      expect(parseCron(bad), bad).toBeNull();
    }
  });
});

describe("describeCron", () => {
  it("recognises the common shapes", () => {
    expect(describeCron("0 6 * * 1")).toEqual({ kind: "weekly", days: [1], hour: 6, minute: 0 });
    expect(describeCron("30 2 * * *")).toEqual({ kind: "daily", hour: 2, minute: 30 });
    expect(describeCron("0 7 * * 1-5")).toEqual({ kind: "weekdays", hour: 7, minute: 0 });
    expect(describeCron("15 * * * *")).toEqual({ kind: "hourly", minute: 15 });
    expect(describeCron("0 5 1 * *")).toEqual({ kind: "monthly", day: 1, hour: 5, minute: 0 });
    expect(describeCron("0 */4 * * *")).toEqual({ kind: "custom" });
    expect(describeCron("nonsense")).toBeNull();
  });
});

describe("nextCronRun", () => {
  it("finds the next Monday at 06:00", () => {
    // Wednesday 2026-11-11 10:00 UTC → Monday 2026-11-16 06:00 UTC.
    const next = nextCronRun("0 6 * * 1", new Date("2026-11-11T10:00:00Z"));
    expect(next?.toISOString()).toBe("2026-11-16T06:00:00.000Z");
  });

  it("applies the time zone offset", () => {
    const next = nextCronRun("0 6 * * *", new Date("2026-11-11T10:00:00Z"), 60);
    expect(next?.toISOString()).toBe("2026-11-12T05:00:00.000Z");
  });
});
