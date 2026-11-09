import type { ImportStatus } from "@onn/api-client/types";
import type { StatusTone } from "@onn/ui/components/status-pill";

export const IMPORT_TONE: Record<ImportStatus, StatusTone> = {
  parsing: "info",
  mapping: "warning",
  validating: "info",
  validated: "info",
  submitted: "positive",
  failed: "negative",
};

/** Brief §7: CSV, XLSX, JSON or XML up to 50 MB. */
export const IMPORT_ACCEPT = [".csv", ".xlsx", ".json", ".xml"];
export const IMPORT_MAX_BYTES = 50 * 1024 * 1024;

/** The wizard's four steps (brief §7). */
export const WIZARD_STEPS = ["upload", "map", "validate", "submit"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
