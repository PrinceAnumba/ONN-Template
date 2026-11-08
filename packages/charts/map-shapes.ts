// Server-side projection: turns TopoJSON into SVG path strings once, so the browser draws the
// interactive map without downloading d3-geo, topojson-client or the boundary file itself.
import { geoMercator, geoPath } from "d3-geo";
import { toFeatures } from "./choropleth-svg";

export interface MapShape {
  code: string;
  name: string;
  /** SVG path in the map's own coordinates. */
  d: string;
  /** Label anchor (centroid). */
  cx: number;
  cy: number;
  /** Projected area, for hiding labels on small shapes. */
  area: number;
}

export interface MapShapes {
  width: number;
  height: number;
  shapes: MapShape[];
}

/** Projects every area to fit `width`, keeping the country's aspect ratio. */
export function projectShapes(
  topology: unknown,
  codeProperty: string,
  width = 800,
  padding = 8,
): MapShapes {
  const features = toFeatures(topology);
  const projection = geoMercator().fitWidth(width - padding * 2, features);
  const path = geoPath(projection).digits(1);
  const [[, y0], [, y1]] = path.bounds(features);
  const height = Math.ceil(y1 - y0) + padding * 2;
  projection.translate([
    projection.translate()[0] + padding,
    projection.translate()[1] - y0 + padding,
  ]);
  const shapes = features.features.map((area) => {
    const [cx, cy] = path.centroid(area);
    return {
      code: area.properties[codeProperty] ?? "",
      name: area.properties.name ?? area.properties[codeProperty] ?? "",
      d: path(area) ?? "",
      cx: Math.round(cx * 10) / 10,
      cy: Math.round(cy * 10) / 10,
      area: Math.round(path.area(area)),
    };
  });
  return { width, height, shapes };
}
