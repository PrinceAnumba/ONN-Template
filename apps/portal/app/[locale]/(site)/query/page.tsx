import { api, serverCache, type RequestContext } from "@onn/api-client";
import type { Area, IndicatorSummary, Observation, Pillar } from "@onn/api-client/types";
import { country } from "@onn/config";
import { formatPeriod, formatValue } from "@onn/ui/format";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { DataDownloadMenu } from "@/components/data-download-menu";
import { CodePanel } from "@/components/query/code-panel";
import { QueryBuilder, type AreaNode } from "@/components/query/query-builder";
import { QueryPreview, type PreviewRow } from "@/components/query/query-preview";
import { ClientMessages } from "@/components/shell/client-messages";
import { tagFor } from "@/lib/format";
import { kindOf } from "@/lib/kpi";
import { siteOrigin } from "@/lib/origin";
import { apiUrl, isComplete, parseQuery, PREVIEW_ROWS, snippets } from "@/lib/query";

/** Absolute base for the API URL and snippets, so they work when pasted into a terminal. */
async function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || siteOrigin();
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return { title: t("query") };
}

/** Country → regions → departments, from the flat area list. */
function areaTree(areas: Area[]): AreaNode[] {
  const subnational = areas.filter((area) => ["adm1", "adm2", "adm3"].includes(area.level));
  const build = (code: string): AreaNode[] =>
    subnational
      .filter((area) => area.parent === code)
      .map((area) => ({ code: area.code, name: area.name, children: build(area.code) }));
  const home = areas.find((area) => area.code === country.iso3);
  return home ? [{ code: home.code, name: home.name, children: build(home.code) }] : [];
}

/** Data query (brief §5.7): three steps on the left, preview, downloads and API code on the right. */
export default async function QueryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const locale = await getLocale();
  const tag = tagFor(locale);
  const ctx: RequestContext = { locale, next: serverCache("query") };
  const [t, pages, chart] = await Promise.all([
    getTranslations("Query"),
    getTranslations("Pages"),
    getTranslations("Chart"),
  ]);

  let pillars: Pillar[] = [];
  let indicators: IndicatorSummary[] = [];
  let areas: Area[] = [];
  try {
    [pillars, indicators, areas] = await Promise.all([
      api.pillars(ctx),
      api.indicators(ctx, { status: "published", pageSize: 200 }).then((page) => page.items),
      api.areas(ctx),
    ]);
  } catch {
    // The builder renders empty; the preview below says it couldn't load.
  }
  // Coverage runs from the earliest indicator start to the latest published year.
  const latestYears = indicators.flatMap((item) =>
    item.latest ? [Number(item.latest.year.slice(0, 4))] : [],
  );
  const lastYear = Math.max(...latestYears, new Date().getFullYear() - 1);
  const first =
    indicators[0] && (await api.indicator(ctx, indicators[0].code).catch(() => undefined));
  const coverage: [number, number] = [
    Number(first?.coverage.from.slice(0, 4)) || lastYear - 10,
    lastYear,
  ];
  const state = parseQuery(await searchParams, coverage);
  const known = new Set(indicators.map((item) => item.code));
  const areaCodes = new Set(areas.map((area) => area.code));
  state.indicators = state.indicators.filter((code) => known.has(code));
  state.areas = state.areas.filter((code) => areaCodes.has(code));
  const applied = isComplete(state);
  const base = await apiBase();

  let rows: Observation[] = [];
  let total = 0;
  let failed = false;
  if (applied) {
    try {
      const page = await api.data(ctx, {
        indicator: state.indicators.join(","),
        area: state.areas.join(","),
        year: `${state.years[0]}-${state.years[1]}`,
        pageSize: PREVIEW_ROWS,
      });
      rows = page.items;
      total = page.meta.total;
    } catch {
      failed = true;
    }
  }

  const byCode = new Map(indicators.map((item) => [item.code, item]));
  const nameOf = new Map(areas.map((area) => [area.code, area.name]));
  const statusLabel = (status: string) =>
    status === "A"
      ? ""
      : chart.has(`status.${status}`)
        ? chart(`status.${status}` as "status.E")
        : status;
  const preview: PreviewRow[] = rows.map((row, i) => {
    const meta = byCode.get(row.indicator);
    const dims = Object.entries(row.dims);
    return {
      id: `${i}`,
      indicator: meta?.name ?? row.indicator,
      area: nameOf.get(row.area) ?? row.area,
      period: formatPeriod(row.period, tag),
      breakdown: dims.length
        ? dims.map(([key, value]) => `${key}: ${value}`).join(", ")
        : t("total"),
      value: row.value,
      display: formatValue(row.value, meta ? kindOf(meta) : "count", tag),
      unit: row.unit,
      status: statusLabel(row.status),
    };
  });
  const query = {
    indicator: state.indicators.join(","),
    area: state.areas.join(","),
    year: `${state.years[0]}-${state.years[1]}`,
  };

  return (
    <main id="content" className="onn-container py-8">
      <h1>{pages("query")}</h1>
      <p className="text-muted-foreground mt-2 max-w-prose">{t("intro")}</p>
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <nav
          aria-label={t("stepsLabel")}
          className="bg-card rounded-lg border px-4 lg:sticky lg:top-[89px] lg:max-h-[calc(100dvh-105px)] lg:overflow-y-auto"
        >
          <ClientMessages namespaces={["Query"]}>
            <QueryBuilder
              indicators={indicators.map(({ code, name, pillar }) => ({ code, name, pillar }))}
              pillars={[...pillars]
                .sort((a, b) => a.order - b.order)
                .map(({ code, name }) => ({ code, name }))}
              tree={areaTree(areas)}
              peers={areas
                .filter((area) => area.level === "country" && area.code !== country.iso3)
                .map(({ code, name }) => ({ code, name }))}
              groups={areas
                .filter((area) => area.level === "group")
                .map(({ code, name }) => ({ code, name }))}
              coverage={coverage}
              initial={state}
            />
          </ClientMessages>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="preview-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="preview-title">{t("preview")}</h2>
                {applied && !failed && (
                  <p role="status" className="text-muted-foreground mt-1 text-sm">
                    {t("rowCount", { count: total })}
                    {total > PREVIEW_ROWS && (
                      <span className="ms-1">{t("previewNote", { shown: PREVIEW_ROWS })}</span>
                    )}
                  </p>
                )}
              </div>
              {applied && !failed && total > 0 && (
                <DataDownloadMenu
                  query={query}
                  variant="secondary"
                  label={t("download")}
                  failed={t("downloadFailed")}
                  fileName="onn-data"
                  formats={[
                    { format: "csv", label: t("csv") },
                    { format: "xlsx", label: t("xlsx") },
                    { format: "json", label: t("json") },
                    { format: "sdmx-csv", label: t("sdmx") },
                  ]}
                />
              )}
            </div>
            <div className="mt-4">
              {!applied ? (
                <p className="bg-surface-2 rounded-lg p-6">{t("empty")}</p>
              ) : failed ? (
                <p role="alert" className="bg-surface-2 rounded-lg p-6">
                  {t("error")}
                </p>
              ) : (
                <QueryPreview
                  caption={t("preview")}
                  rows={preview}
                  labels={{
                    indicator: t("columns.indicator"),
                    area: t("columns.area"),
                    period: t("columns.period"),
                    breakdown: t("columns.breakdown"),
                    value: t("columns.value"),
                    unit: t("columns.unit"),
                    status: t("columns.status"),
                    empty: t("noRows"),
                    sortBy: t.raw("sortBy") as string,
                  }}
                />
              )}
            </div>
          </section>
          {applied && (
            <CodePanel
              url={apiUrl(base, state, "csv")}
              snippets={snippets(base, state)}
              labels={{
                title: t("code"),
                apiUrl: t("apiUrl"),
                language: t("language"),
                copyUrl: t("copyUrl"),
                copyCode: t.raw("copyCode") as string,
                copied: t("copied"),
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
}
