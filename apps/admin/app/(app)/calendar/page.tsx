import { adminApi } from "@onn/api-client/admin";
import type { CalendarItem } from "@onn/api-client/types";
import { country } from "@onn/config";
import { tagFor } from "@onn/config/locale";
import { EmptyState } from "@onn/ui/components/empty-state";
import { StatusPill } from "@onn/ui/components/status-pill";
import { cn } from "@onn/ui/lib/utils";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const TONE = { upcoming: "neutral", received: "positive", overdue: "negative" } as const;

/** Today's month in the country's time zone, as YYYY-MM. */
function thisMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: country.timezone,
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  return parts.slice(0, 7);
}

function shift(month: string, by: number) {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, mon - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}

/** The month's days as weeks starting on Monday, with null for days outside the month. */
function weeks(month: string) {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

interface CalendarProps {
  searchParams: Promise<{ month?: string; view?: string }>;
}

/** Collection calendar (brief §7): month grid or list; overdue in red. Phones always get the list. */
export default async function CalendarPage({ searchParams }: CalendarProps) {
  const params = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.calendar");
  const statusLabel = await getTranslations("Admin.status.calendar");
  const month = params.month && MONTH.test(params.month) ? params.month : thisMonth();
  const view = params.view === "list" ? "list" : "grid";
  const items = await adminApi.calendar({ locale, token: session.token }, month, session.activeOrg);

  const tag = tagFor(locale);
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const title = new Intl.DateTimeFormat(tag, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, mon - 1, 1)));
  // Monday first: 2024-01-01 was a Monday.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, 1 + i)),
    ),
  );
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) byDay.set(item.deadline, [...(byDay.get(item.deadline) ?? []), item]);
  const href = (changes: { month?: string; view?: string }) => {
    const next = new URLSearchParams();
    const m = changes.month ?? month;
    const v = changes.view ?? view;
    if (m !== thisMonth()) next.set("month", m);
    if (v === "list") next.set("view", "list");
    const query = next.toString();
    return query ? `/calendar?${query}` : "/calendar";
  };

  const list = (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="font-semibold">{item.indicatorSet}</p>
            <p className="text-muted-foreground text-sm">
              {t("meta", { org: item.orgName, period: item.period })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-sm tabular-nums",
                item.status === "overdue" && "text-negative font-semibold",
              )}
            >
              {formatDate(item.deadline, locale, "medium")}
            </span>
            <StatusPill tone={TONE[item.status]} label={statusLabel(item.status)} />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <h1 className="text-h1">{t("title")}</h1>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={href({ month: shift(month, -1) })}
            aria-label={t("previous")}
            className="hover:bg-surface-2 inline-flex size-11 items-center justify-center rounded-md border"
          >
            <ChevronLeftIcon aria-hidden className="size-5 rtl:rotate-180" />
          </Link>
          <h2 className="text-h3 min-w-44 text-center first-letter:uppercase" aria-live="polite">
            {title}
          </h2>
          <Link
            href={href({ month: shift(month, 1) })}
            aria-label={t("next")}
            className="hover:bg-surface-2 inline-flex size-11 items-center justify-center rounded-md border"
          >
            <ChevronRightIcon aria-hidden className="size-5 rtl:rotate-180" />
          </Link>
          {month !== thisMonth() && (
            <Link href={href({ month: thisMonth() })} className="ms-2 underline">
              {t("today")}
            </Link>
          )}
        </div>
        <nav aria-label={t("viewLabel")} className="hidden md:block">
          <ul className="flex rounded-md border">
            {(["grid", "list"] as const).map((option) => (
              <li key={option}>
                <Link
                  href={href({ view: option })}
                  aria-current={view === option ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center px-4 text-sm",
                    view === option && "bg-primary text-primary-foreground font-semibold",
                  )}
                >
                  {t(`view.${option}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState icon={CalendarIcon} message={t("empty")} />
        ) : (
          <>
            <div className={cn(view === "grid" && "md:hidden")}>{list}</div>
            {view === "grid" && (
              <table className="hidden w-full table-fixed border-collapse md:table">
                <caption className="sr-only">{t("gridCaption", { month: title })}</caption>
                <thead>
                  <tr>
                    {weekdays.map((day) => (
                      <th
                        key={day}
                        scope="col"
                        className="text-muted-foreground border-b p-2 text-start text-sm font-semibold"
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks(month).map((week, index) => (
                    <tr key={index}>
                      {week.map((day, dayIndex) =>
                        day ? (
                          <td key={day} className="h-28 border p-1.5 align-top">
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {Number(day.slice(8))}
                            </span>
                            <ul className="mt-1 flex flex-col gap-1">
                              {(byDay.get(day) ?? []).map((item) => (
                                <li
                                  key={item.id}
                                  className={cn(
                                    "rounded-sm border-s-4 px-1.5 py-0.5 text-xs",
                                    item.status === "overdue"
                                      ? "border-negative text-negative font-semibold"
                                      : item.status === "received"
                                        ? "border-positive"
                                        : "border-border",
                                  )}
                                >
                                  <span className="block truncate">{item.orgName}</span>
                                  <span className="block truncate">{statusLabel(item.status)}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        ) : (
                          <td key={`empty-${dayIndex}`} className="bg-surface-2 border" />
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </>
  );
}
