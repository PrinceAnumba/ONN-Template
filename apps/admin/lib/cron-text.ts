import { describeCron, nextCronRun } from "@onn/api-client/cron";
import { country } from "@onn/config";
import { tagFor } from "@onn/config/locale";

/** next-intl's `t` for the `Admin.connectors.cron` namespace, from either side. */
export type CronT = (key: string, values?: Record<string, string | number>) => string;

const SUNDAY = Date.UTC(2024, 0, 7);
const DAY = 24 * 60 * 60 * 1000;

/** Puts a schedule into words (brief §7: "Every Monday at 06:00"); null when it isn't valid. */
export function cronText(expression: string, t: CronT, locale: string): string | null {
  const shape = describeCron(expression);
  if (!shape) return null;
  const tag = tagFor(locale);
  const time = (hour: number, minute: number) =>
    new Intl.DateTimeFormat(tag, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    }).format(Date.UTC(2024, 0, 1, hour, minute));
  const weekday = (day: number) =>
    new Intl.DateTimeFormat(tag, { weekday: "long", timeZone: "UTC" }).format(SUNDAY + day * DAY);
  switch (shape.kind) {
    case "hourly":
      return t("hourly", { minute: shape.minute });
    case "daily":
      return t("daily", { time: time(shape.hour, shape.minute) });
    case "weekdays":
      return t("weekdays", { time: time(shape.hour, shape.minute) });
    case "weekly":
      return t("weekly", {
        days: new Intl.ListFormat(tag, { type: "conjunction" }).format(shape.days.map(weekday)),
        time: time(shape.hour, shape.minute),
      });
    case "monthly":
      return t("monthly", { day: shape.day, time: time(shape.hour, shape.minute) });
    default:
      return t("custom");
  }
}

/** Minutes the country's time zone is ahead of UTC at a given moment. */
function offsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: country.timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(at);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const local = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
  );
  return Math.round((local - at.getTime()) / 60000);
}

/** When the schedule next fires, in the country's time zone. */
export function nextRun(expression: string, from = new Date()) {
  return nextCronRun(expression, from, offsetMinutes(from));
}
