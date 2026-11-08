import { describe, expect, it } from "vitest";
import { pageWindow } from "./components/pagination";

describe("pageWindow", () => {
  it("shows every page when there are few", () => {
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("collapses long runs into a gap, but never hides a single page behind one", () => {
    expect(pageWindow(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageWindow(3, 12)).toEqual([1, 2, 3, 4, null, 12]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });
});
