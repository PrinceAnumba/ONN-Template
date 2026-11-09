import { adminApi } from "@onn/api-client/admin";
import { can } from "@onn/api-client/permissions";
import type { CalendarItem, SubmissionSummary } from "@onn/api-client/types";
import { Sparkline } from "@onn/ui/components/sparkline";
import { StatusPill } from "@onn/ui/components/status-pill";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatDate, formatNumber } from "@/lib/format";
import { requireSession } from "@/lib/session";

function Card({
  title,
  link,
  className,
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`bg-background flex min-w-0 flex-col rounded-lg border p-5 ${className ?? ""}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-h3">{title}</h2>
        {link && (
          <Link href={link.href} className="shrink-0 text-sm underline">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

/** Back-office dashboard (brief §7): role-aware cards for the active organisation. */
export default async function DashboardPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.dashboard");
  const status = await getTranslations("Admin.status");
  const overview = await adminApi.overview({ locale, token: session.token }, session.activeOrg);
  const { roles } = session;

  const taskGroups: { key: "verify" | "approve" | "returned"; items: SubmissionSummary[] }[] = [
    ...(can(roles, "submission.verify")
      ? [{ key: "verify" as const, items: overview.tasks.verify }]
      : []),
    ...(can(roles, "submission.approve")
      ? [{ key: "approve" as const, items: overview.tasks.approve }]
      : []),
    ...(can(roles, "submission.submit")
      ? [{ key: "returned" as const, items: overview.tasks.returned }]
      : []),
  ];
  const hasTasks = taskGroups.length > 0;
  const quality = overview.quality;
  const qualityChange = Math.round((quality.passRate - quality.previous) * 100);
  const totalVisits = overview.usage.reduce((sum, day) => sum + day.visits, 0);
  const deadlineTone = (item: CalendarItem) => (item.status === "overdue" ? "negative" : "neutral");

  return (
    <>
      <h1 className="text-h1">{t("title", { name: session.user.name })}</h1>
      <p className="text-muted-foreground mt-1">{t("intro")}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {hasTasks && (
          <Card
            title={t("tasks")}
            link={{ href: "/submissions", label: t("allSubmissions") }}
            className="md:col-span-2 xl:col-span-1 xl:row-span-2"
          >
            {taskGroups.every((group) => group.items.length === 0) ? (
              <Empty>{t("noTasks")}</Empty>
            ) : (
              <div className="flex flex-col gap-4">
                {taskGroups
                  .filter((group) => group.items.length > 0)
                  .map((group) => (
                    <div key={group.key}>
                      <h3 className="text-sm font-semibold">
                        {t(`taskGroup.${group.key}`, { count: group.items.length })}
                      </h3>
                      <ul className="mt-2 divide-y">
                        {group.items.map((item) => (
                          <li key={item.id} className="py-2">
                            <Link
                              href={`/submissions/${item.id}`}
                              className="flex min-h-11 flex-col justify-center rounded-sm"
                            >
                              <span className="font-semibold underline">
                                {t("taskLine", { id: item.id, period: item.period })}
                              </span>
                              <span className="text-muted-foreground truncate text-sm">
                                {t("metaLine", {
                                  first: item.orgName,
                                  second: formatDate(item.updated, locale, "medium"),
                                })}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        )}

        <Card title={t("deadlines")} link={{ href: "/calendar", label: t("calendar") }}>
          {overview.deadlines.length === 0 ? (
            <Empty>{t("noDeadlines")}</Empty>
          ) : (
            <ul className="divide-y">
              {overview.deadlines.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.indicatorSet}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {t("metaLine", { first: item.orgName, second: item.period })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`text-sm tabular-nums ${item.status === "overdue" ? "text-negative font-semibold" : ""}`}
                    >
                      {formatDate(item.deadline, locale, "medium")}
                    </span>
                    <StatusPill
                      tone={deadlineTone(item)}
                      label={status(`calendar.${item.status}`)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("quality")} link={{ href: "/quality", label: t("qualityLink") }}>
          <p className="text-kpi">{formatNumber(quality.passRate, locale, { style: "percent" })}</p>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("qualityChange", { change: qualityChange })}
          </p>
          <p className="mt-3 text-sm">{t("openWarnings", { count: quality.openWarnings })}</p>
        </Card>

        {can(roles, "connector.view") && (
          <Card title={t("connectors")} link={{ href: "/connectors", label: t("connectorsLink") }}>
            {overview.connectorFailures.length === 0 ? (
              <Empty>{t("noConnectorFailures")}</Empty>
            ) : (
              <ul className="divide-y">
                {overview.connectorFailures.map((item) => (
                  <li key={item.id} className="py-2">
                    <Link href={`/connectors/${item.id}`} className="font-semibold underline">
                      {item.name}
                    </Link>
                    <p className="text-negative text-sm">{item.error}</p>
                    <p className="text-muted-foreground text-xs">
                      {t("lastRun", { date: formatDate(item.lastRun, locale, "medium") })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {can(roles, "feedback.view") && (
          <Card title={t("feedback")} link={{ href: "/feedback", label: t("feedbackLink") }}>
            {overview.feedback.length === 0 ? (
              <Empty>{t("noFeedback")}</Empty>
            ) : (
              <ul className="divide-y">
                {overview.feedback.map((item) => (
                  <li key={item.id} className="py-2">
                    <p className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-semibold">
                        {item.rating ? t("rating", { rating: item.rating }) : t("noRating")}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatDate(item.date, locale, "medium")}
                      </span>
                    </p>
                    {item.message && <p className="line-clamp-2 text-sm">{item.message}</p>}
                    <p className="text-muted-foreground truncate text-xs">{item.page}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {can(roles, "usage.view") && overview.usage.length > 0 && (
          <Card title={t("usage")}>
            <p className="text-kpi">{formatNumber(totalVisits, locale)}</p>
            <p className="text-muted-foreground mt-1 text-sm">{t("usagePeriod")}</p>
            <Sparkline values={overview.usage.map((day) => day.visits)} className="mt-4 h-12" />
            <p className="sr-only">
              {t("usageSummary", {
                first: formatNumber(overview.usage[0]!.visits, locale),
                last: formatNumber(overview.usage.at(-1)!.visits, locale),
              })}
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
