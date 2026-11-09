/// <reference lib="webworker" />
// Service worker (brief §8 offline), built by @serwist/next into public/sw.js.
import { country } from "@onn/config";
import type { PrecacheEntry, SerwistGlobalConfig, SerwistPlugin } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

/**
 * A navigation with nothing cached gets the offline page in its own language. Its scripts are
 * removed: the page's own JS chunk was never cached, and a failed chunk load makes Next replace
 * the page with an error. Pages read without JavaScript (§9), so the HTML alone is enough.
 */
const offlinePage: SerwistPlugin = {
  handlerDidError: async ({ request }) => {
    if (request.mode !== "navigate") return undefined;
    const segment = new URL(request.url).pathname.split("/")[1] ?? "";
    const locale = country.locales.enabled.includes(segment) ? segment : country.locales.default;
    const cached = await serwist.matchPrecache(`/${locale}/offline`);
    if (!cached) return Response.error();
    const html = (await cached.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
};

const serwist = new Serwist({
  // Fonts, brand files, and each locale's home and offline pages (next.config.ts).
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // The admin zone shares the domain but never gets cached data (brief §8).
    { matcher: ({ url }) => url.pathname.startsWith("/admin"), handler: new NetworkOnly() },
    // Boundaries: cache-first, they change only with official files.
    {
      matcher: ({ url, request }) =>
        request.method === "GET" &&
        (url.pathname.startsWith("/geo/") || /\/areas\/[^/]+\/geometry$/.test(url.pathname)),
      handler: new CacheFirst({
        cacheName: "onn-topojson",
        plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 30 * DAY })],
      }),
    },
    // Browser GET calls to the API: stale-while-revalidate, 200 entries, 7 days.
    {
      matcher: ({ url, request }) =>
        request.method === "GET" && url.pathname.startsWith("/api/v1/"),
      handler: new StaleWhileRevalidate({
        cacheName: "onn-api",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * DAY })],
      }),
    },
    // Hashed build files: cached as pages use them, never precached in bulk (that would
    // download MapLibre, ECharts and Scalar on a first visit).
    {
      matcher: ({ url }) => url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "onn-static",
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * DAY })],
      }),
    },
    // Pages and their RSC payloads: network first, so visited pages still open offline.
    {
      matcher: ({ request }) =>
        request.mode === "navigate" ||
        request.headers.get("RSC") === "1" ||
        request.headers.get("X-ONN-Warm") === "page",
      handler: new NetworkFirst({
        cacheName: "onn-pages",
        plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * DAY }), offlinePage],
      }),
    },
  ],
});

serwist.addEventListeners();
