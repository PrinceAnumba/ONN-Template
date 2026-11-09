"use client";

import { encodePreview, PREVIEW_MAX_LENGTH } from "@onn/api-client/preview";
import type { Widget } from "@onn/api-client/types";
import { Skeleton } from "@onn/ui/components/skeleton";
import { cn } from "@onn/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { portalUrl } from "@/lib/content";

/** Matches `EMBED_HEIGHT_MESSAGE` in the portal's embed pages. */
const HEIGHT_MESSAGE = "onn-embed-height";

/** The portal's preview embed for draft widgets, or null when the URL would be too long. */
export function previewSrc(locale: string, widgets: Widget[]) {
  if (widgets.length === 0) return null;
  const encoded = encodePreview(widgets);
  return encoded.length > PREVIEW_MAX_LENGTH
    ? null
    : portalUrl(`/${locale}/embed/preview?d=${encoded}`);
}

/** Waits until `value` has stopped changing for `ms`, so typing doesn't reload the preview. */
export function useDebounced<T>(value: T, ms = 600) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * A portal page in an iframe, sized to its content by the embed's height message. Shows a
 * skeleton while each new address loads; the previous page stays underneath until then.
 */
export function PreviewFrame({
  src,
  title,
  minHeight = 240,
  className,
}: {
  src: string;
  /** Accessible name of the frame. */
  title: string;
  minHeight?: number;
  className?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);
  const [loading, setLoading] = useState(true);

  useEffect(() => setLoading(true), [src]);
  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { type?: string; height?: number } | null;
      if (data?.type === HEIGHT_MESSAGE && typeof data.height === "number") {
        setHeight(Math.max(minHeight, Math.min(data.height, 4000)));
      }
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [minHeight]);

  return (
    <div className={cn("bg-background relative overflow-hidden rounded-md border", className)}>
      <iframe
        ref={frame}
        src={src}
        title={title}
        loading="lazy"
        onLoad={() => setLoading(false)}
        className="block w-full border-0"
        style={{ height }}
      />
      {loading && (
        <div className="bg-background absolute inset-0 flex flex-col gap-3 p-4" aria-hidden="true">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-full w-full" />
        </div>
      )}
    </div>
  );
}
