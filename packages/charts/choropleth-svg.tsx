import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

export type AreaFeatures = FeatureCollection<Geometry, Record<string, string>>;

export function toFeatures(topology: unknown, objectName = "areas"): AreaFeatures {
  const topo = topology as Topology<{ [key: string]: GeometryCollection }>;
  const object = topo.objects[objectName];
  if (!object) throw new Error(`Topology has no object "${objectName}"`);
  return feature(topo, object) as unknown as AreaFeatures;
}

export interface ChoroplethSvgProps {
  topology: unknown;
  codeProperty: string;
  /** Fill per area code; null draws the no-data hatch. */
  fills: Record<string, string | null>;
  /** Accessible name for the map as a whole. */
  title: string;
  /** Per-area tooltip text, e.g. "Dakar: 93.5 %". */
  labels?: Record<string, string>;
  selected?: string;
  width?: number;
  height?: number;
  /** Unique per page, for the hatch pattern id. */
  id: string;
  className?: string;
}

/** Choropleth as plain SVG: server-rendered, works without JavaScript (brief §5.4). */
export function ChoroplethSvg({
  topology,
  codeProperty,
  fills,
  title,
  labels = {},
  selected,
  width = 640,
  height = 480,
  id,
  className,
}: ChoroplethSvgProps) {
  const features = toFeatures(topology);
  const projection = geoMercator().fitExtent(
    [
      [8, 8],
      [width - 8, height - 8],
    ],
    features,
  );
  const path = geoPath(projection);
  const hatch = `${id}-hatch`;

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ width: "100%", height: "auto" }}
    >
      <defs>
        <pattern
          id={hatch}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill="var(--onn-surface)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--onn-compare)" strokeWidth="2" />
        </pattern>
      </defs>
      {features.features.map((area) => {
        const code = area.properties[codeProperty] ?? "";
        const fill = fills[code];
        return (
          <path
            key={code}
            d={path(area) ?? undefined}
            fill={fill ?? `url(#${hatch})`}
            stroke={code === selected ? "var(--onn-primary-ink)" : "var(--onn-surface)"}
            strokeWidth={code === selected ? 3 : 1}
          >
            <title>{labels[code] ?? area.properties.name ?? code}</title>
          </path>
        );
      })}
    </svg>
  );
}
