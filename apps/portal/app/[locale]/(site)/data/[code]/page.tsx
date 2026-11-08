import { serverCache } from "@onn/api-client";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import {
  ChartView,
  IndicatorHeader,
  IndicatorSide,
  MapView,
  TableView,
} from "@/components/indicator/sections";
import { IndicatorToolbar } from "@/components/indicator/toolbar";
import { isSubnational } from "@/lib/indicator";
import { getIndicator, loadIndicatorView } from "@/lib/indicator-view";
import { serializeUrlState } from "@/lib/url-state";

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<SearchParams>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const locale = await getLocale();
  const indicator = await getIndicator(decodeURIComponent(code), {
    locale,
    next: serverCache(`indicator:${decodeURIComponent(code)}`),
  });
  return { title: indicator.name, description: indicator.shortDefinition };
}

export default async function IndicatorPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const locale = await getLocale();
  const view = await loadIndicatorView(decodeURIComponent(code), searchParams, locale);
  const { indicator } = view;
  const t = await getTranslations("Indicator");

  const views = isSubnational(indicator)
    ? (["chart", "table", "map"] as const)
    : (["chart", "table"] as const);
  const breakdowns = [
    { value: "total", label: t("dims.total") },
    ...indicator.disaggregations.map((key) => ({
      value: key,
      label: t.has(`dims.${key}`) ? t(`dims.${key}` as "dims.sex") : key,
    })),
  ];
  const embedQuery = serializeUrlState({
    i: [indicator.code],
    a: view.state.a,
    c: view.state.c,
    y: view.state.y,
    d: view.state.d,
    u: view.state.u,
  });

  return (
    <main id="content" className="py-6 lg:py-8">
      <IndicatorHeader view={view} />
      <IndicatorToolbar
        title={indicator.name}
        views={[...views]}
        view={view.view}
        units={indicator.unitVariants}
        unit={view.unit.code}
        breakdowns={breakdowns}
        breakdown={view.dimension ?? "total"}
        coverage={view.coverage}
        range={view.range}
        download={view.downloadQuery}
        embedUrl={`${SITE_URL}/${locale}/embed/chart${embedQuery}`}
        labels={{
          toolbar: t("toolbar"),
          view: t("view"),
          views: { chart: t("views.chart"), table: t("views.table"), map: t("views.map") },
          unit: t("unit"),
          breakdown: t("breakdown"),
          years: t("years"),
          fromYear: t("fromYear"),
          toYear: t("toYear"),
          downloadData: t("downloadData"),
          formats: { csv: t("csv"), xlsx: t("xlsx"), json: t("json") },
          downloadFailed: t("downloadFailed"),
          share: t("share"),
          linkCopied: t("linkCopied"),
          embed: t("embed"),
          embedCopied: t("embedCopied"),
          updating: t("updating"),
        }}
      />
      <div className="mt-6 grid gap-10 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          {view.view === "chart" && <ChartView view={view} />}
          {view.view === "table" && <TableView view={view} />}
          {view.view === "map" && <MapView view={view} />}
        </div>
        <Suspense fallback={null}>
          <IndicatorSide view={view} />
        </Suspense>
      </div>
    </main>
  );
}
