import { api, serverCache, type RequestContext } from "@onn/api-client";
import type { Area } from "@onn/api-client/types";

export interface SelectorIndicator {
  code: string;
  name: string;
  unit: string;
  pillar: string;
  theme: string;
  synonyms: string[];
  subnational: boolean;
}

export interface SelectorData {
  indicators: SelectorIndicator[];
  dashboards: { slug: string; title: string }[];
  areas: Area[];
}

const EMPTY: SelectorData = { indicators: [], dashboards: [], areas: [] };

/** A failed lookup leaves the bar empty rather than taking the page down with it. */
export async function getSelectorData(locale: string): Promise<SelectorData> {
  const ctx: RequestContext = { locale, next: serverCache("selector") };
  try {
    const [pillars, indicators, dashboards, areas] = await Promise.all([
      api.pillars(ctx),
      api.indicators(ctx, { status: "published", pageSize: 200 }),
      api.dashboards(ctx),
      api.areas(ctx),
    ]);
    const pillarName = new Map(pillars.map((pillar) => [pillar.code, pillar]));
    return {
      indicators: indicators.items.map((item) => {
        const pillar = pillarName.get(item.pillar);
        return {
          code: item.code,
          name: item.name,
          unit: item.unit,
          pillar: pillar?.name ?? item.pillar,
          theme: pillar?.themes.find((theme) => theme.code === item.theme)?.name ?? item.theme,
          synonyms: item.synonyms,
          subnational: item.geoLevels.length > 1,
        };
      }),
      dashboards: dashboards.map(({ slug, title }) => ({ slug, title })),
      areas,
    };
  } catch {
    return EMPTY;
  }
}
