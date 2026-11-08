// Server-side loading for the map (brief §5.4): boundaries projected to SVG paths, plus every
// year's values for the level, so the year slider and play button never wait on the network.
import { api, type RequestContext } from "@onn/api-client";
import type { Indicator, Observation } from "@onn/api-client/types";
import { projectShapes, type MapShapes } from "@onn/charts/map-shapes";
import { country } from "@onn/config";
import { getTranslations } from "next-intl/server";
import { formatDate } from "./format";
import { valuesByYear } from "./map";

const PAGE_SIZE = 500;
const MAP_WIDTH = 800;

export interface MapArea {
  code: string;
  name: string;
  level: string;
  parent?: string;
}

export interface MapData {
  indicator: {
    code: string;
    name: string;
    unitKind: string;
    unitLabel: string;
    higherIsBetter: boolean;
    disaggregations: string[];
  };
  source: string;
  levels: { key: string; label: string }[];
  level: string;
  /** Null when the boundaries for this level can't be loaded. */
  shapes: MapShapes | null;
  /** Raw boundaries, sent only when the MapLibre basemap is enabled. */
  topology?: unknown;
  years: string[];
  /** Values per area code, aligned with `years`. */
  values: Record<string, (number | null)[]>;
  /** Every sub-national area, for names, siblings and children. */
  areas: MapArea[];
}

async function allObservations(
  ctx: RequestContext,
  query: { indicator: string; level: string; unit?: string },
) {
  const first = await api.data(ctx, { ...query, pageSize: PAGE_SIZE });
  const rows: Observation[] = [...first.items];
  const pages = Math.ceil(first.meta.total / first.meta.pageSize);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      api.data(ctx, { ...query, pageSize: PAGE_SIZE, page: i + 2 }),
    ),
  );
  for (const page of rest) rows.push(...page.items);
  return rows;
}

/** Levels of the country config that this indicator is published at. */
export function mapLevels(indicator: Pick<Indicator, "geoLevels">, locale: string) {
  return country.geography.levels
    .filter((level) => indicator.geoLevels.includes(level.key))
    .map((level) => ({ key: level.key, label: level.label[locale] ?? level.key }));
}

export async function loadMapData({
  indicator,
  level: requested,
  unit,
  ctx,
  locale,
}: {
  indicator: Indicator;
  level: string | null;
  unit?: { code: string; label: string };
  ctx: RequestContext;
  locale: string;
}): Promise<MapData> {
  const t = await getTranslations("Indicator");
  const levels = mapLevels(indicator, locale);
  const level = levels.find((item) => item.key === requested)?.key ?? levels[0]?.key ?? "adm1";
  const variant = unit ?? indicator.unitVariants[0] ?? { code: "count", label: indicator.unit };
  const unitParam = variant.code === indicator.unitVariants[0]?.code ? undefined : variant.code;

  const [topology, rows, areas] = await Promise.all([
    api.geometry(ctx, country.iso3, level).catch(() => null),
    allObservations(ctx, { indicator: indicator.code, level, unit: unitParam }),
    api.areas(ctx),
  ]);
  const { years, values } = valuesByYear(rows);

  return {
    indicator: {
      code: indicator.code,
      name: indicator.name,
      unitKind: variant.code,
      unitLabel: variant.label,
      higherIsBetter: indicator.higherIsBetter,
      disaggregations: indicator.disaggregations,
    },
    source: t("source", {
      org: indicator.source.org,
      method: t(`method.${indicator.source.method}`),
      date: formatDate(indicator.lastUpdated, locale),
    }),
    levels,
    level,
    shapes: topology ? projectShapes(topology, country.geography.codeProperty, MAP_WIDTH) : null,
    topology: topology && country.features.basemap ? topology : undefined,
    years,
    values,
    areas: areas
      .filter((area) => area.level !== "country" && area.level !== "group")
      .map(({ code, name, level: areaLevel, parent }) => ({
        code,
        name,
        level: areaLevel,
        parent,
      })),
  };
}
