import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, apiUrl } from "./client";
import { api, ExportTimeoutError, pollExport, serverCache } from "./endpoints";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function mockFetch(...results: (Response | Error)[]) {
  const fn = vi.fn(async () => {
    const next = results.shift();
    if (!next) throw new Error("Unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fn);
  return fn as unknown as ReturnType<typeof vi.fn> & typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("apiUrl", () => {
  it("drops empty query values", () => {
    expect(apiUrl("/indicators", { q: "", pillar: "CONN", page: undefined })).toBe(
      "http://localhost:4000/api/v1/indicators?pillar=CONN",
    );
  });
});

describe("apiFetch", () => {
  it("sends the locale", async () => {
    const fetchMock = mockFetch(json({ ok: true }));
    await apiFetch("/home", { locale: "en" });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({ "Accept-Language": "en" });
  });

  it("retries once on network failure", async () => {
    const fetchMock = mockFetch(new TypeError("network"), json({ ok: true }));
    await expect(apiFetch("/home", { locale: "en" })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the second network failure", async () => {
    const fetchMock = mockFetch(new TypeError("a"), new TypeError("b"));
    await expect(apiFetch("/home", { locale: "en" })).rejects.toThrow("b");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx and parses Problem into ApiError", async () => {
    const problem = { type: "about:blank", title: "Not found", status: 404, detail: "No such" };
    const fetchMock = mockFetch(json(problem, 404));
    const error = await apiFetch("/x", { locale: "en" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).message).toBe("No such");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("builds an ApiError when the body is not JSON", async () => {
    mockFetch(new Response("boom", { status: 502 }));
    const error = await apiFetch("/x", { locale: "en" }).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(502);
  });

  it("does not retry after the caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = mockFetch(new DOMException("Aborted", "AbortError"));
    await expect(apiFetch("/home", { locale: "en", signal: controller.signal })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("serverCache", () => {
  it("uses the 300 s window and passes tags to fetch", async () => {
    const fetchMock = mockFetch(json({}));
    await api.indicator({ locale: "en", next: serverCache("indicator:A") }, "A");
    const init = fetchMock.mock.calls[0]?.[1] as { next: unknown };
    expect(init.next).toEqual({ revalidate: 300, tags: ["indicator:A"] });
  });
});

describe("pollExport", () => {
  it("polls until the job finishes", async () => {
    vi.useFakeTimers();
    mockFetch(json({ status: "running" }), json({ status: "done", url: "/f" }));
    const result = pollExport({ locale: "en" }, "1");
    await vi.advanceTimersByTimeAsync(1_500);
    await expect(result).resolves.toEqual({ status: "done", url: "/f" });
  });

  it("stops at the limit", async () => {
    mockFetch(json({ status: "running" }));
    await expect(pollExport({ locale: "en" }, "1", 0)).rejects.toBeInstanceOf(ExportTimeoutError);
  });
});
