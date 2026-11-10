import { adminApi } from "@onn/api-client/admin";
import type { AlertCondition } from "@onn/api-client/types";
import { EmptyState } from "@onn/ui/components/empty-state";
import { StatusPill } from "@onn/ui/components/status-pill";
import { BellIcon, HistoryIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { listHref, ListPager, PrimaryLink, TabLinks, TableFrame } from "@/components/list";
import { EVENT_TONE } from "@/lib/editorial";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { PAGE_SIZES } from "@/lib/submissions";

interface AlertsProps {
  searchParams: Promise<{ tab?: string; rule?: string; page?: string; size?: string }>;
}

/** Alerts (brief §7): the rules, and the log of what they sent. */
export default async function AlertsPage({ searchParams }: AlertsProps) {
  const params = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.alerts");
  const forms = await getTranslations("Admin.forms");
  const ctx = { locale, token: session.token };
  const showEvents = params.tab === "events";
  const pageSize = PAGE_SIZES.find((size) => String(size) === params.size) ?? PAGE_SIZES[0]!;
  const [{ rules }, events] = await Promise.all([
    adminApi.alerts(ctx),
    showEvents
      ? adminApi.alertEvents(ctx, {
          rule: params.rule || undefined,
          page: Number(params.page) || 1,
          pageSize,
        })
      : null,
  ]);
  const create = <PrimaryLink href="/alerts/new">{t("new")}</PrimaryLink>;
  const number = (value: number) => formatNumber(value, locale, { maximumFractionDigits: 1 });
  const percent = (value: number) =>
    formatNumber(value / 100, locale, { style: "percent", maximumFractionDigits: 1 });
  const what = (rule: {
    condition: AlertCondition;
    operator?: "above" | "below";
    value?: number;
  }) =>
    rule.condition === "threshold" && rule.value !== undefined
      ? t(`ruleText.${rule.operator === "above" ? "above" : "below"}`, {
          value: number(rule.value),
        })
      : rule.condition === "change" && rule.value !== undefined
        ? t("ruleText.change", { value: percent(rule.value) })
        : t(`condition.${rule.condition}`);
  const filterRule = rules.find((rule) => rule.id === params.rule);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-h1">{t("title")}</h1>
        {create}
      </div>
      <TabLinks
        label={t("tabsLabel")}
        tabs={[
          { href: "/alerts", label: t("tab.rules"), active: !showEvents, count: rules.length },
          { href: "/alerts?tab=events", label: t("tab.events"), active: showEvents },
        ]}
      />

      {!showEvents && (
        <div className="mt-6">
          {rules.length === 0 ? (
            <EmptyState icon={BellIcon} message={t("empty")} action={create} />
          ) : (
            <TableFrame
              label={t("tab.rules")}
              columns={(
                ["name", "indicator", "condition", "notify", "status", "last"] as const
              ).map((key) => t(`column.${key}`))}
            >
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t align-top">
                  <th scope="row" className="min-w-48 p-3 text-start font-semibold">
                    <Link href={`/alerts/${rule.id}`} className="underline">
                      {rule.name}
                    </Link>
                  </th>
                  <td className="min-w-40 p-3">{rule.indicatorName}</td>
                  <td className="p-3">{what(rule)}</td>
                  <td className="p-3">
                    {t("notify", {
                      count: rule.recipients.length,
                      channels: rule.channels.map((channel) => t(`channel.${channel}`)).join(", "),
                    })}
                  </td>
                  <td className="p-3">
                    <StatusPill
                      tone={rule.enabled ? "positive" : "neutral"}
                      label={t(rule.enabled ? "enabled" : "paused")}
                    />
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {rule.lastTriggered ? (
                      <Link
                        href={`/alerts?tab=events&rule=${rule.id}`}
                        className="underline"
                        aria-label={t("lastLink", {
                          date: formatDate(rule.lastTriggered, locale, "medium"),
                          name: rule.name,
                        })}
                      >
                        {formatDate(rule.lastTriggered, locale, "medium")}
                      </Link>
                    ) : (
                      t("never")
                    )}
                  </td>
                </tr>
              ))}
            </TableFrame>
          )}
        </div>
      )}

      {events && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p role="status" className="text-muted-foreground">
              {filterRule
                ? t("eventCountFor", { count: events.meta.total, name: filterRule.name })
                : t("eventCount", { count: events.meta.total })}
            </p>
            {params.rule && (
              <Link
                href="/alerts?tab=events"
                className="inline-flex min-h-11 items-center underline"
              >
                {forms("clearFilters")}
              </Link>
            )}
          </div>
          <div className="mt-2">
            {events.items.length === 0 ? (
              <EmptyState icon={HistoryIcon} message={t("noEvents")} />
            ) : (
              <TableFrame
                label={t("tab.events")}
                columns={(["date", "rule", "indicator", "what", "sent", "status"] as const).map(
                  (key) => t(`eventColumn.${key}`),
                )}
              >
                {events.items.map((event) => (
                  <tr key={event.id} className="border-t align-top">
                    <td className="p-3 whitespace-nowrap">
                      {forms("dateTime", {
                        date: formatDate(event.date, locale, "medium"),
                        time: formatTime(event.date, locale),
                      })}
                    </td>
                    <th scope="row" className="min-w-44 p-3 text-start font-semibold">
                      {rules.some((rule) => rule.id === event.rule) ? (
                        <Link href={`/alerts/${event.rule}`} className="underline">
                          {event.ruleName}
                        </Link>
                      ) : (
                        event.ruleName
                      )}
                    </th>
                    <td className="min-w-40 p-3">{event.indicatorName}</td>
                    <td className="p-3">
                      {event.value === undefined
                        ? t(`condition.${event.condition}`)
                        : event.condition === "change"
                          ? t("eventText.change", {
                              value: percent(event.value),
                              period: event.period ?? "",
                            })
                          : t("eventText.threshold", {
                              value: number(event.value),
                              unit: event.unit ?? "",
                              period: event.period ?? "",
                            })}
                    </td>
                    <td className="p-3">
                      {t("notify", {
                        count: event.recipients,
                        channels: event.channels
                          .map((channel) => t(`channel.${channel}`))
                          .join(", "),
                      })}
                    </td>
                    <td className="p-3">
                      <StatusPill
                        tone={EVENT_TONE[event.status]}
                        label={t(`eventStatus.${event.status}`)}
                      />
                    </td>
                  </tr>
                ))}
              </TableFrame>
            )}
          </div>
          <ListPager
            meta={events.meta}
            href={({ page, size }) =>
              listHref("/alerts", { tab: "events", rule: params.rule, size, page })
            }
          />
        </>
      )}
    </>
  );
}
