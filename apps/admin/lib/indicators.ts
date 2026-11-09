import type { IndicatorRecord, IndicatorStatus, Periodicity } from "@onn/api-client/types";
import type { StatusTone } from "@onn/ui/components/status-pill";

export const INDICATOR_STATUSES: IndicatorStatus[] = ["published", "in_collection", "planned"];
export const INDICATOR_TONE: Record<IndicatorStatus, StatusTone> = {
  published: "positive",
  in_collection: "info",
  planned: "neutral",
};
export const PERIODICITIES: Periodicity[] = ["monthly", "quarterly", "annual", "biennial"];
/** Breakdown keys the contract knows (`IndicatorSummary.disaggregations`). */
export const DIMENSIONS = ["sex", "age_group", "area", "operator"];
export const INTL_ORGS = ["ITU", "WB", "UN", "AU"] as const;
export const PRIORITY_KEYS = ["availability", "quality", "strategic", "comparability"] as const;

/** Editor tabs in the brief's order (§7 Indicators). */
export const EDITOR_TABS = [
  "general",
  "definition",
  "units",
  "dimensions",
  "geography",
  "thresholds",
  "goalposts",
  "references",
  "calendar",
  "priority",
  "versions",
] as const;
export type EditorTab = (typeof EDITOR_TABS)[number];

const TAB_OF: Partial<Record<keyof IndicatorRecord, EditorTab>> = {
  status: "general",
  pillar: "general",
  theme: "general",
  org: "general",
  name: "general",
  shortDefinition: "general",
  synonyms: "general",
  licence: "general",
  isHeadline: "general",
  definition: "definition",
  computation: "definition",
  qualityNotes: "definition",
  unit: "units",
  unitVariants: "units",
  higherIsBetter: "units",
  disaggregations: "dimensions",
  geoLevels: "geography",
  thresholds: "thresholds",
  goalposts: "goalposts",
  intlRefs: "references",
  periodicity: "calendar",
  nextRelease: "calendar",
  priority: "priority",
};

/** The tab holding a field from an error path such as `goalposts.max` or `name.fr`. */
export function tabOfPath(path: string): EditorTab {
  return TAB_OF[path.split(".")[0] as keyof IndicatorRecord] ?? "general";
}
