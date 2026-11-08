"use client";

import * as React from "react";
import type { MapLibreViewProps } from "./maplibre-view";

export interface ChoroplethMapProps {
  topology: unknown;
  codeProperty: string;
  fills: Record<string, string | null>;
  bbox: [number, number, number, number];
  selected?: string;
  onSelect?: (code: string) => void;
  onHover?: (code: string | null) => void;
  /** Server-rendered SVG of the same map, shown until MapLibre is ready and in Lite mode. */
  fallback: React.ReactNode;
  lite?: boolean;
  height?: number | string;
  workerUrl?: string;
  basemap?: MapLibreViewProps["basemap"];
  className?: string;
}

/**
 * MapLibre on the client, loaded only when the map nears the viewport (brief §5.4). Uses the
 * fills computed by `choropleth()`, so its colours match the server SVG exactly.
 */
export function ChoroplethMap({
  lite,
  fallback,
  height = 480,
  className,
  ...props
}: ChoroplethMapProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [near, setNear] = React.useState(false);
  const [View, setView] = React.useState<React.ComponentType<MapLibreViewProps> | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (lite || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && setNear(true),
      { rootMargin: "200px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [lite]);

  React.useEffect(() => {
    if (!near) return;
    void import("./maplibre-view").then((module) => setView(() => module.MapLibreView));
  }, [near]);

  return (
    <div ref={ref} className={className} style={{ position: "relative", height }}>
      {!ready && <div style={{ position: "absolute", inset: 0 }}>{fallback}</div>}
      {View && !lite && (
        <div style={{ position: "absolute", inset: 0 }} aria-hidden={!ready}>
          <View {...props} onReady={() => setReady(true)} />
        </div>
      )}
    </div>
  );
}
