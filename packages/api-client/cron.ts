// Five-field cron expressions for connector schedules (brief §7: "schedule with cron helper text
// 'Every Monday at 06:00'"). Shared by the mock, which refuses invalid ones, and the admin, which
// describes them. Supports numbers, `*`, lists, ranges and steps; no names (MON, JAN).

const FIELDS = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 7 }, // day of week, 0 and 7 are Sunday
] as const;

/** The values each field allows, or null when the expression is invalid. */
export function parseCron(expression: string): number[][] | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const fields: number[][] = [];
  for (const [index, part] of parts.entries()) {
    const { min, max } = FIELDS[index]!;
    const values = new Set<number>();
    for (const item of part.split(",")) {
      const match = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(item);
      if (!match) return null;
      const step = match[4] ? Number(match[4]) : 1;
      const from = match[1] === "*" ? min : Number(match[2]);
      const to = match[1] === "*" ? max : match[3] ? Number(match[3]) : match[4] ? max : from;
      if (step < 1 || from < min || to > max || from > to) return null;
      for (let value = from; value <= to; value += step)
        values.add(index === 4 ? value % 7 : value);
    }
    fields.push([...values].sort((a, b) => a - b));
  }
  return fields;
}

export type CronDescription =
  | { kind: "hourly"; minute: number }
  | { kind: "daily"; hour: number; minute: number }
  | { kind: "weekdays"; hour: number; minute: number }
  | { kind: "weekly"; days: number[]; hour: number; minute: number }
  | { kind: "monthly"; day: number; hour: number; minute: number }
  | { kind: "custom" };

const isAll = (part: string) => part === "*";
const single = (part: string) => /^\d+$/.test(part);

/** A shape the UI can put into words; anything else is "custom". Null when invalid. */
export function describeCron(expression: string): CronDescription | null {
  const fields = parseCron(expression);
  if (!fields) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = expression.trim().split(/\s+/) as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (!single(minute) || !isAll(month)) return { kind: "custom" };
  const m = Number(minute);
  if (isAll(hour) && isAll(dayOfMonth) && isAll(dayOfWeek)) return { kind: "hourly", minute: m };
  if (!single(hour)) return { kind: "custom" };
  const h = Number(hour);
  if (isAll(dayOfMonth) && isAll(dayOfWeek)) return { kind: "daily", hour: h, minute: m };
  if (isAll(dayOfMonth)) {
    const days = fields[4]!;
    if (days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day))) {
      return { kind: "weekdays", hour: h, minute: m };
    }
    return { kind: "weekly", days, hour: h, minute: m };
  }
  if (single(dayOfMonth) && isAll(dayOfWeek)) {
    return { kind: "monthly", day: Number(dayOfMonth), hour: h, minute: m };
  }
  return { kind: "custom" };
}

/** The next time the schedule fires after `from`, in the given UTC offset (minutes). */
export function nextCronRun(expression: string, from: Date, offsetMinutes = 0): Date | null {
  const fields = parseCron(expression);
  if (!fields) return null;
  const [minutes, hours, days, months, weekdays] = fields as [
    number[],
    number[],
    number[],
    number[],
    number[],
  ];
  const parts = expression.trim().split(/\s+/);
  const anyDay = parts[2] === "*";
  const anyWeekday = parts[4] === "*";
  // Walk minute by minute in local time; a year is the longest gap a valid schedule can have.
  const local = new Date(from.getTime() + offsetMinutes * 60_000);
  local.setUTCSeconds(0, 0);
  for (let step = 0; step < 366 * 24 * 60; step++) {
    local.setUTCMinutes(local.getUTCMinutes() + 1);
    if (!months.includes(local.getUTCMonth() + 1)) continue;
    const dayOk = days.includes(local.getUTCDate());
    const weekdayOk = weekdays.includes(local.getUTCDay());
    // Standard cron: when both day fields are restricted, either may match.
    const matches =
      anyDay && anyWeekday ? true : anyDay ? weekdayOk : anyWeekday ? dayOk : dayOk || weekdayOk;
    if (!matches || !hours.includes(local.getUTCHours())) continue;
    if (!minutes.includes(local.getUTCMinutes())) continue;
    return new Date(local.getTime() - offsetMinutes * 60_000);
  }
  return null;
}
