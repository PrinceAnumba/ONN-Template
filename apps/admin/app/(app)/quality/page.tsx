import { adminApi } from "@onn/api-client/admin";
import type { QualityRule } from "@onn/api-client/types";
import { Chart } from "@onn/charts/chart";
import type { BarSpec, LineSpec } from "@onn/charts/spec";
import { country } from "@onn/config";
import { tagFor } from "@onn/config/locale";
import { EmptyState } from "@onn/ui/components/empty-state";
import { PageSizeLinks, Pagination } from "@onn/ui/components/pagination";
import { StatusPill } from "@onn/ui/components/status-pill";
import { EMPTY_VALUE } from "@onn/ui/format";
import { CircleCheckIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { chartFrameLabels, lineLabels } from "@/lib/chart-labels";
import { formatDate, formatNumber } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { PAGE_SIZES, STATUS_TONE } from "@/lib/submissions";

/** Indicators with the lowest pass rates shown in the chart; the table lists them all. */
const LOWEST = 12;
const ROW_HEIGHT = 30;

interface QualityProps {
  searchParams: Promise<{ page?: string; size?: string }>;
}

/** Quality (brief §7): pass rates by organisation, indicator and month, and open warnings. */
export default async function QualityPage({ searchParams }: QualityProps) {
  const params = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.qualityPage");
  const rules = await getTranslations("Admin.quality.rule");
  const status = await getTranslations("Admin.status.submission");
  const common = await getTranslations("Common");
  const data = await adminApi.quality({ locale, token: session.token }, session.activeOrg);
  const labels = await chartFrameLabels();
  const tag = tagFor(locale);
  const percent = (value: number | null) =>
    value === null
      ? EMPTY_VALUE
      : formatNumber(value, locale, { style: "percent", maximumFractionDigits: 1 });
  const monthName = (month: string) =>
    new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 15),
    );
  const change = Math.round((data.passRate - data.previous) * 1000) / 10;
  const logoUrl = `/admin${country.brand.logo}`;

  const bar = (items: { label: string; value: number | null }[], category: string): BarSpec => ({
    kind: "bar",
    tag,
    unitKind: "pct",
    items: items.map((item) => ({ ...item, focus: true })),
    width: 600,
    labels: { category, value: t("passRate"), median: "" },
  });
  const byOrg = bar(
    data.byOrg.map((item) => ({
      label: item.name,
      value: item.passRate === null ? null : item.passRate * 100,
    })),
    t("org"),
  );
  const lowest = data.byIndicator.filter((item) => item.passRate !== null).slice(0, LOWEST);
  const byIndicator = bar(
    lowest.map((item) => ({ label: item.name, value: (item.passRate ?? 0) * 100 })),
    t("indicator"),
  );
  // Start at the first month with data: ECharts animates the end label from the first point,
  // and a leading gap gives it no position.
  const firstMonth = data.byMonth.findIndex((item) => item.checked > 0);
  const months = firstMonth < 0 ? [] : data.byMonth.slice(firstMonth);
  const byMonth: LineSpec = {
    kind: "line",
    tag,
    unitKind: "pct",
    series: [
      {
        name: t("passRate"),
        role: "focus",
        points: months.map((item) => ({
          period: item.month,
          value: item.passRate === null ? null : Math.round(item.passRate * 1000) / 10,
        })),
      },
    ],
    labels: await lineLabels(),
  };
  const list = (items: { name: string; rate: number | null }[]) =>
    items.map((item) => t("summaryItem", { name: item.name, rate: percent(item.rate) })).join(", ");

  const pageSize = PAGE_SIZES.find((size) => String(size) === params.size) ?? PAGE_SIZES[0]!;
  const pageCount = Math.max(1, Math.ceil(data.warnings.length / pageSize));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pageCount);
  const warnings = data.warnings.slice((page - 1) * pageSize, page * pageSize);
  const href = (target: number, size = pageSize) => {
    const query = new URLSearchParams();
    if (target > 1) query.set("page", String(target));
    if (size !== PAGE_SIZES[0]) query.set("size", String(size));
    return query.size ? `/quality?${query}#warnings` : "/quality#warnings";
  };

  return (
    <>
      <h1 className="text-h1">{t("title")}</h1>
      <p className="text-muted-foreground mt-1 max-w-3xl">{t("intro")}</p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <dt className="text-muted-foreground text-sm">{t("passRate")}</dt>
          <dd className="text-kpi">{percent(data.passRate)}</dd>
          <dd className="text-muted-foreground text-sm">
            {t("change", { points: formatNumber(change, locale, { signDisplay: "exceptZero" }) })}
          </dd>
        </div>
        <div className="rounded-lg border p-4">
          <dt className="text-muted-foreground text-sm">{t("checked")}</dt>
          <dd className="text-kpi">{formatNumber(data.checked, locale)}</dd>
        </div>
        <div className="rounded-lg border p-4">
          <dt className="text-muted-foreground text-sm">{t("openWarnings")}</dt>
          <dd className="text-kpi">{formatNumber(data.warnings.length, locale)}</dd>
        </div>
      </dl>

      <h2 className="text-h2 mt-10">{t("chartsTitle")}</h2>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <Chart
            spec={data.byOrg.length ? byOrg : undefined}
            status={data.byOrg.length ? "ready" : "empty"}
            title={t("byOrg")}
            subtitle={t("byOrgSubtitle")}
            summary={t("byOrgSummary", {
              items: list(data.byOrg.map((item) => ({ name: item.name, rate: item.passRate }))),
            })}
            labels={labels}
            width={600}
            height={Math.max(220, data.byOrg.length * ROW_HEIGHT + 80)}
            mobileHeight={Math.max(220, data.byOrg.length * ROW_HEIGHT + 80)}
            fileName="quality-by-organisation"
            logoUrl={logoUrl}
            showShare={false}
          />
        </div>
        <div className="min-w-0">
          <Chart
            spec={months.length ? byMonth : undefined}
            status={months.length ? "ready" : "empty"}
            title={t("byMonth")}
            subtitle={t("byMonthSubtitle")}
            summary={t("byMonthSummary", {
              items: months
                .map((item) =>
                  t("summaryItem", {
                    name: monthName(item.month),
                    rate: percent(item.passRate),
                  }),
                )
                .join(", "),
            })}
            labels={labels}
            width={600}
            height={320}
            fileName="quality-by-month"
            logoUrl={logoUrl}
            showShare={false}
          />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Chart
            spec={lowest.length ? byIndicator : undefined}
            status={lowest.length ? "ready" : "empty"}
            title={t("byIndicator", { count: lowest.length })}
            subtitle={t("byIndicatorSubtitle")}
            summary={t("byIndicatorSummary", {
              items: list(lowest.map((item) => ({ name: item.name, rate: item.passRate }))),
            })}
            labels={labels}
            width={900}
            height={lowest.length * ROW_HEIGHT + 80}
            mobileHeight={lowest.length * ROW_HEIGHT + 80}
            fileName="quality-by-indicator"
            logoUrl={logoUrl}
            showShare={false}
          />
        </div>
      </div>

      <section aria-labelledby="warnings" className="mt-10">
        <h2 id="warnings" className="text-h2">
          {t("warningsTitle", { count: data.warnings.length })}
        </h2>
        <p className="text-muted-foreground mt-1">{t("warningsIntro")}</p>
        {data.warnings.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={CircleCheckIcon} message={t("warningsEmpty")} />
          </div>
        ) : (
          <div className="relative mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                {t("warningsTitle", { count: data.warnings.length })}
              </caption>
              <thead className="bg-surface-2">
                <tr>
                  {(
                    [
                      "submission",
                      "indicator",
                      "area",
                      "period",
                      "value",
                      "rule",
                      "status",
                      "updated",
                    ] as const
                  ).map((key) => (
                    <th
                      key={key}
                      scope="col"
                      className="p-3 text-start font-semibold whitespace-nowrap"
                    >
                      {t(`column.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {warnings.map((item, index) => (
                  <tr
                    key={`${item.submission}-${item.indicator}-${item.area}-${index}`}
                    className="border-t"
                  >
                    <th scope="row" className="p-3 text-start font-semibold">
                      <Link
                        href={`/submissions/${item.submission}?tab=quality`}
                        className="underline"
                      >
                        {item.submission}
                      </Link>
                      <span className="text-muted-foreground block text-xs font-normal">
                        {item.orgName}
                      </span>
                    </th>
                    <td className="p-3">
                      {item.indicatorName}
                      <span className="text-muted-foreground block font-mono text-xs">
                        {item.indicator}
                      </span>
                    </td>
                    <td className="p-3">{item.areaName}</td>
                    <td className="p-3 whitespace-nowrap">{item.period}</td>
                    <td className="p-3 text-end tabular-nums">
                      {item.value === null ? EMPTY_VALUE : formatNumber(item.value, locale)}
                    </td>
                    <td className="p-3">{rules(item.rule as QualityRule)}</td>
                    <td className="p-3">
                      <StatusPill tone={STATUS_TONE[item.status]} label={status(item.status)} />
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {formatDate(item.updated, locale, "medium")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.warnings.length > PAGE_SIZES[0]! && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <PageSizeLinks
              sizes={PAGE_SIZES}
              current={pageSize}
              href={(size) => href(1, size)}
              label={t("pageSize")}
              linkAs={Link}
            />
            <Pagination
              page={page}
              pageCount={pageCount}
              href={(target) => href(target)}
              labels={{
                nav: common("pagination"),
                previous: common("previous"),
                next: common("next"),
                page: common("pageN", { page: "{page}" }),
              }}
              linkAs={Link}
            />
          </div>
        )}
      </section>
    </>
  );
}
