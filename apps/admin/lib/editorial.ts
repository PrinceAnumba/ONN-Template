import type {
  AlertChannel,
  AlertCondition,
  AlertEvent,
  CampaignStatus,
  NewsStatus,
  PageBlock,
  WatchStatus,
} from "@onn/api-client/types";
import type { StatusTone } from "@onn/ui/components/status-pill";

export const NEWS_STATUSES: NewsStatus[] = ["draft", "scheduled", "published"];
export const NEWS_TONE: Record<NewsStatus, StatusTone> = {
  draft: "neutral",
  scheduled: "info",
  published: "positive",
};

export const WATCH_STATUSES: WatchStatus[] = ["pending", "approved", "rejected"];

export const BLOCK_TYPES: PageBlock["type"][] = [
  "richText",
  "callout",
  "image",
  "table",
  "partners",
];
/** Where the portal shows each CMS page. */
export const PAGE_PATHS: Record<string, string> = {
  about: "/about",
  methodology: "/about/methodology",
  partners: "/about/partners",
  privacy: "/legal/privacy",
  terms: "/legal/terms",
  accessibility: "/accessibility",
};
/** Limits the server enforces, so the editor stops offering more. */
export const MAX_TABLE_ROWS = 30;
export const MAX_TABLE_COLUMNS = 6;
export const MAX_CHIPS = 8;
export const MAX_FEATURED = 8;
export const MAX_TAGS = 10;

export const ALERT_CONDITIONS: AlertCondition[] = [
  "threshold",
  "change",
  "off_track",
  "overdue",
  "anomaly",
];
export const ALERT_CHANNELS: AlertChannel[] = ["email", "sms", "in_app"];
export const EVENT_TONE: Record<AlertEvent["status"], StatusTone> = {
  sent: "positive",
  failed: "negative",
};

export const CAMPAIGN_TONE: Record<CampaignStatus, StatusTone> = {
  draft: "neutral",
  scheduled: "info",
  sent: "positive",
};
export const MAX_CAMPAIGN_ITEMS = 12;

/** A `datetime-local` value (the browser's time zone) as an ISO instant, or undefined. */
export function localToIso(value: string) {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

/** Splits a comma or line separated field into trimmed, distinct entries. */
export function splitList(text: string) {
  return [
    ...new Set(
      text
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
