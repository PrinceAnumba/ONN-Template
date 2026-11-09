// Loaded after the page is idle (see offline-status.tsx), so no page carries this up front.
import { readOutbox } from "@/lib/outbox";
import type { OutboxLabels } from "./outbox-sync";

/**
 * The page that installed the worker loaded before it was in control, so nothing it used is
 * cached. Ask the worker to fetch the page and its build files once, so it opens offline too.
 */
function warmCache(registration: ServiceWorkerRegistration) {
  const files = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((url) => url.startsWith(`${location.origin}/_next/static/`));
  registration.active?.postMessage({
    type: "CACHE_URLS",
    payload: { urlsToCache: [[location.href, { headers: { "X-ONN-Warm": "page" } }], ...files] },
  });
}

export function registerWorker() {
  if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
  const first = !navigator.serviceWorker.controller;
  void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  if (first) void navigator.serviceWorker.ready.then(warmCache);
}

/** Sends forms saved offline, loading the sender only when there is something to send. */
export function flushIfQueued(labels: OutboxLabels) {
  if (!navigator.onLine || readOutbox().length === 0) return;
  void import("./outbox-sync").then(({ flushOutbox }) => flushOutbox(labels));
}
