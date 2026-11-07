"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { chartTokens } from "@onn/config/tokens";
import { Map as MapLibreMap, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import * as React from "react";
import { toFeatures } from "./choropleth-svg";

export interface MapLibreViewProps {
  topology: unknown;
  codeProperty: string;
  fills: Record<string, string | null>;
  bbox: [number, number, number, number];
  selected?: string;
  onSelect?: (code: string) => void;
  onHover?: (code: string | null) => void;
  onReady?: () => void;
  /** Where copy-maplibre.mjs put the worker; prefix it with the app's basePath. */
  workerUrl?: string;
}

const NONE = "__none__";
const DEFAULT_WORKER_URL = "/vendor/maplibre/maplibre-gl-worker.mjs";

function hatchImage() {
  const size = 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = chartTokens.surface;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = chartTokens.compare;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

/** No basemap by default: boundaries on --onn-surface (brief §5.4). */
export function MapLibreView({
  topology,
  codeProperty,
  fills,
  bbox,
  selected,
  onSelect,
  onHover,
  onReady,
  workerUrl = DEFAULT_WORKER_URL,
}: MapLibreViewProps) {
  const container = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<MapLibreMap | null>(null);
  const callbacks = React.useRef({ onSelect, onHover, onReady });
  callbacks.current = { onSelect, onHover, onReady };

  const data = React.useMemo(() => {
    const features = toFeatures(topology);
    for (const area of features.features) {
      const code = area.properties[codeProperty] ?? "";
      area.properties.fill = fills[code] ?? "";
    }
    return features;
  }, [topology, codeProperty, fills]);

  React.useEffect(() => {
    if (!container.current) return;
    setWorkerUrl(new URL(workerUrl, window.location.href).href);
    const instance = new MapLibreMap({
      container: container.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": chartTokens.surface },
          },
        ],
      },
      bounds: bbox,
      fitBoundsOptions: { padding: 16 },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.current = instance;
    instance.on("load", () => {
      instance.addImage("hatch", hatchImage());
      instance.addSource("areas", { type: "geojson", data });
      instance.addLayer({
        id: "fill",
        type: "fill",
        source: "areas",
        filter: ["!=", ["get", "fill"], ""],
        paint: { "fill-color": ["get", "fill"] },
      });
      instance.addLayer({
        id: "no-data",
        type: "fill",
        source: "areas",
        filter: ["==", ["get", "fill"], ""],
        paint: { "fill-pattern": "hatch" },
      });
      instance.addLayer({
        id: "outline",
        type: "line",
        source: "areas",
        paint: { "line-color": chartTokens.compare, "line-width": 0.75 },
      });
      instance.addLayer({
        id: "hover",
        type: "line",
        source: "areas",
        filter: ["==", ["get", codeProperty], NONE],
        paint: { "line-color": chartTokens.ink, "line-width": 2 },
      });
      instance.addLayer({
        id: "selected",
        type: "line",
        source: "areas",
        filter: ["==", ["get", codeProperty], selected ?? NONE],
        paint: { "line-color": chartTokens.primaryInk, "line-width": 3 },
      });
      const hit = ["fill", "no-data"];
      instance.on("mousemove", hit, (event) => {
        const code = String(event.features?.[0]?.properties?.[codeProperty] ?? "");
        instance.getCanvas().style.cursor = "pointer";
        instance.setFilter("hover", ["==", ["get", codeProperty], code || NONE]);
        callbacks.current.onHover?.(code || null);
      });
      instance.on("mouseleave", hit, () => {
        instance.getCanvas().style.cursor = "";
        instance.setFilter("hover", ["==", ["get", codeProperty], NONE]);
        callbacks.current.onHover?.(null);
      });
      instance.on("click", hit, (event) => {
        const code = event.features?.[0]?.properties?.[codeProperty];
        if (code) callbacks.current.onSelect?.(String(code));
      });
      callbacks.current.onReady?.();
    });
    return () => {
      instance.remove();
      map.current = null;
    };
    // The map is created once; data and selection updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const source = map.current?.getSource("areas") as GeoJSONSource | undefined;
    source?.setData(data);
  }, [data]);

  React.useEffect(() => {
    if (map.current?.getLayer("selected")) {
      map.current.setFilter("selected", ["==", ["get", codeProperty], selected ?? NONE]);
    }
  }, [selected, codeProperty]);

  return <div ref={container} style={{ position: "absolute", inset: 0 }} />;
}
