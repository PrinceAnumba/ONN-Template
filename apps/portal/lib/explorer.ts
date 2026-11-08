import { api, serverCache, type RequestContext } from "@onn/api-client";
import type { TreePillar } from "./explorer-tree";

/** Pillar → theme → indicator tree of published indicators (brief §5.2). */
export async function getExplorerTree(locale: string): Promise<TreePillar[]> {
  // Same requests as the selector bar, so Next's fetch cache serves them once.
  const ctx: RequestContext = { locale, next: serverCache("selector") };
  try {
    const [pillars, indicators] = await Promise.all([
      api.pillars(ctx),
      api.indicators(ctx, { status: "published", pageSize: 200 }),
    ]);
    return [...pillars]
      .sort((a, b) => a.order - b.order)
      .map((pillar) => {
        const themes = pillar.themes
          .map((theme) => ({
            code: theme.code,
            name: theme.name,
            indicators: indicators.items
              .filter((item) => item.pillar === pillar.code && item.theme === theme.code)
              .map(({ code, name, synonyms }) => ({ code, name, synonyms })),
          }))
          .filter((theme) => theme.indicators.length > 0);
        return {
          code: pillar.code,
          name: pillar.name,
          themes,
          count: themes.reduce((sum, theme) => sum + theme.indicators.length, 0),
        };
      })
      .filter((pillar) => pillar.count > 0);
  } catch {
    return [];
  }
}
