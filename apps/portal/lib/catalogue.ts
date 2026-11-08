// Catalogue filters (brief §5.8). The page renders every indicator once; filtering runs on the
// client from the same functions the server uses for the no-JavaScript form, so both agree.

export const FACETS = ["pillar", "source", "periodicity", "status", "sub"] as const;
export type Facet = (typeof FACETS)[number];

export const COLUMNS = [
  "code",
  "name",
  "pillar",
  "unit",
  "periodicity",
  "source",
  "intl",
  "sub",
  "updated",
  "status",
] as const;
export type Column = (typeof COLUMNS)[number];

export interface CatalogueRow {
  code: string;
  name: string;
  synonyms: string[];
  pillar: string;
  unit: string;
  periodicity: string;
  source: string;
  /** e.g. "ITU: i99H", or "" when there is no international equivalent. */
  intl: string;
  /** "yes" when published below national level. */
  sub: "yes" | "no";
  /** ISO date, for sorting. */
  updated: string;
  updatedLabel: string;
  status: string;
}

export interface CatalogueState {
  q: string;
  filters: Record<Facet, string[]>;
}

type Params = Record<string, string | string[] | undefined>;

/** Reads `?q=&pillar=A,B` and the repeated keys a plain GET form sends (`pillar=A&pillar=B`). */
export function parseCatalogue(params: Params): CatalogueState {
  const list = (key: string) =>
    [params[key] ?? []]
      .flat()
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean);
  const q = [params.q ?? ""].flat()[0] ?? "";
  return {
    q: q.trim(),
    filters: Object.fromEntries(
      FACETS.map((facet) => [facet, [...new Set(list(facet))]]),
    ) as Record<Facet, string[]>,
  };
}

/** Comma lists, defaults left out, so the URL stays short and matches what the parser reads. */
export function catalogueSearch(state: CatalogueState) {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  for (const facet of FACETS) {
    if (state.filters[facet].length) params.set(facet, state.filters[facet].join(","));
  }
  return params.toString().replaceAll("%2C", ",");
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function matches(row: CatalogueRow, state: CatalogueState, skip?: Facet) {
  if (state.q) {
    const text = fold([row.code, row.name, ...row.synonyms].join(" "));
    if (
      !fold(state.q)
        .split(/\s+/)
        .every((word) => text.includes(word))
    )
      return false;
  }
  return FACETS.every(
    (facet) =>
      facet === skip || !state.filters[facet].length || state.filters[facet].includes(row[facet]),
  );
}

export function filterRows(rows: CatalogueRow[], state: CatalogueState) {
  return rows.filter((row) => matches(row, state));
}

/** Count per option with every other facet applied, so each number is what ticking it would add. */
export function facetCounts(rows: CatalogueRow[], state: CatalogueState, facet: Facet) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (matches(row, state, facet)) counts.set(row[facet], (counts.get(row[facet]) ?? 0) + 1);
  }
  return counts;
}

export function activeFilterCount(state: CatalogueState) {
  return FACETS.reduce((sum, facet) => sum + state.filters[facet].length, 0);
}
