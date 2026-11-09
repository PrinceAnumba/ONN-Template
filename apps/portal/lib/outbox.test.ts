import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isOffline, queueForm, readOutbox, removeFromOutbox } from "./outbox";

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => vi.unstubAllGlobals());

describe("outbox", () => {
  it("queues, reads and removes forms", () => {
    expect(queueForm({ kind: "subscribe", email: "a@b.org", locale: "fr" })).toBe(true);
    expect(queueForm({ kind: "feedback", fields: { rating: "4", page: "/" } })).toBe(true);
    const items = readOutbox();
    expect(items.map((item) => item.kind)).toEqual(["subscribe", "feedback"]);
    removeFromOutbox(items[0]!.id);
    expect(readOutbox()).toHaveLength(1);
    removeFromOutbox(items[1]!.id);
    expect(readOutbox()).toEqual([]);
  });

  it("reports failure when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    });
    expect(queueForm({ kind: "subscribe", email: "a@b.org", locale: "fr" })).toBe(false);
  });

  it("ignores corrupt storage", () => {
    localStorage.setItem("onn-outbox", "{not json");
    expect(readOutbox()).toEqual([]);
  });

  it("tells network failures from server answers", () => {
    expect(isOffline(new TypeError("Failed to fetch"))).toBe(true);
    expect(isOffline(new DOMException("timeout", "TimeoutError"))).toBe(true);
    expect(isOffline(new Error("422"))).toBe(false);
    vi.stubGlobal("navigator", { onLine: false });
    expect(isOffline()).toBe(true);
  });
});
