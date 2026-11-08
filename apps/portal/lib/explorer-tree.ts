// Pure explorer helpers, safe to import from client components.

export interface TreeIndicator {
  code: string;
  name: string;
  synonyms: string[];
}
export interface TreeTheme {
  code: string;
  name: string;
  indicators: TreeIndicator[];
}
export interface TreePillar {
  code: string;
  name: string;
  themes: TreeTheme[];
  count: number;
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Keeps the indicators matching `query` by name, code or synonym, and drops empty branches. */
export function filterTree(tree: TreePillar[], query: string): TreePillar[] {
  const needle = fold(query.trim());
  if (!needle) return tree;
  return tree
    .map((pillar) => {
      const themes = pillar.themes
        .map((theme) => ({
          ...theme,
          indicators: theme.indicators.filter((item) =>
            [item.name, item.code, ...item.synonyms].some((text) => fold(text).includes(needle)),
          ),
        }))
        .filter((theme) => theme.indicators.length > 0);
      return {
        ...pillar,
        themes,
        count: themes.reduce((sum, theme) => sum + theme.indicators.length, 0),
      };
    })
    .filter((pillar) => pillar.count > 0);
}

/** Trend for the profile table, with the same ±0.5 % flat band as KPI cards. */
export function trendOf(changePct: number | undefined) {
  if (changePct === undefined) return "none" as const;
  if (Math.abs(changePct) < 0.5) return "flat" as const;
  return changePct > 0 ? ("up" as const) : ("down" as const);
}
