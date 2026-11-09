import type { ConnectorAuth, ConnectorRunStatus, ConnectorType } from "@onn/api-client/types";
import type { StatusTone } from "@onn/ui/components/status-pill";

export const CONNECTOR_TYPES: ConnectorType[] = ["sdmx", "rest", "sftp", "csv"];
export const CONNECTOR_AUTHS: ConnectorAuth[] = ["none", "token", "basic"];
export const RUN_TONE: Record<ConnectorRunStatus, StatusTone> = {
  ok: "positive",
  failed: "negative",
};
/** Shown as examples under the schedule field. */
export const SCHEDULE_EXAMPLES = ["0 6 * * 1", "30 2 * * *", "0 7 1 * *"];
