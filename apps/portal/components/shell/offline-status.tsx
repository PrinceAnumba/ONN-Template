"use client";

import { country } from "@onn/config";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { tagFor } from "@/lib/format";
import { OUTBOX_EVENT } from "@/lib/outbox";

const loadWorker = () => import("./offline-worker");

/**
 * Offline support (brief §8): shows the offline banner with the date the page was rendered (for
 * a cached page, when it was saved). Once the page is idle it registers the service worker and
 * sends any forms saved offline; that code loads in its own chunk.
 */
export function OfflineStatus({ locale }: { locale: string }) {
  const t = useTranslations("Offline");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const labels = {
      feedbackSent: t("feedbackSent"),
      subscribeSent: t("subscribeSent"),
      sendFailed: t("sendFailed"),
    };
    const flush = () => void loadWorker().then((worker) => worker.flushIfQueued(labels));
    const update = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) flush();
    };
    setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener(OUTBOX_EVENT, flush);

    // Off the critical path: after load, when the browser is idle.
    let idle: number | undefined;
    const start = () => {
      const run = () =>
        void loadWorker().then((worker) => {
          worker.registerWorker();
          worker.flushIfQueued(labels);
        });
      idle =
        typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback(run)
          : window.setTimeout(run, 1);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener(OUTBOX_EVENT, flush);
      window.removeEventListener("load", start);
      if (idle !== undefined && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idle);
      }
    };
  }, [t]);

  const rendered = offline ? document.documentElement.dataset.renderedAt : undefined;
  const date = rendered
    ? new Intl.DateTimeFormat(tagFor(locale), {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: country.timezone,
      }).format(new Date(rendered))
    : "";
  // The live region is always in the page, so screen readers announce the banner when it fills.
  return (
    <div role="status">
      {offline && (
        <p className="bg-foreground text-sm text-white">
          <span className="onn-container block py-2">
            {date ? t("banner", { date }) : t("bannerNoDate")}
          </span>
        </p>
      )}
    </div>
  );
}
