import { Chart } from "@onn/charts/chart";
import { ChoroplethInteractive } from "@onn/charts/choropleth-interactive";
import { MapLegend } from "@onn/charts/map-legend";
import { KpiCard } from "@onn/ui/components/kpi-card";
import { Markdown } from "@onn/ui/components/markdown";
import { TargetProgress } from "@onn/ui/components/target-progress";
import { WidgetShell } from "@onn/ui/components/widget-shell";
import { formatValue } from "@onn/ui/format";
import { getTranslations } from "next-intl/server";
import { IndicatorTable } from "@/components/indicator/indicator-table";
import { chartFrameLabels } from "@/lib/chart-labels";
import { isLite } from "@/lib/lite";
import type { WidgetModel } from "@/lib/dashboard";

/** Server render width per column span, so chart text isn't scaled before hydration. */
const WIDTH = { 1: 400, 2: 820, 3: 1232 } as const;

/** One dashboard widget (brief §5.5), mapped to its §6 component. */
export async function WidgetView({ model, tag }: { model: WidgetModel; tag: string }) {
  const t = await getTranslations("Dashboard");
  const status = await getTranslations("Chart");
  const ind = await getTranslations("Indicator");
  const { body } = model;

  let content: React.ReactNode;
  switch (body.kind) {
    case "chart":
      content = (
        <Chart
          bare
          lite={await isLite()}
          spec={body.spec}
          title={model.title}
          summary={body.summary}
          labels={await chartFrameLabels()}
          width={WIDTH[model.span]}
          height={300}
          mobileHeight={260}
          toggle={
            body.toggle
              ? {
                  label: t("mode"),
                  field: "mode",
                  options: [
                    { value: "absolute", label: t("absolute") },
                    { value: "percent", label: t("percent") },
                  ],
                }
              : undefined
          }
        />
      );
      break;
    case "kpi":
      content = (
        <KpiCard
          {...body.card}
          className="min-h-0 border-0 p-0 hover:translate-y-0 hover:shadow-none"
        />
      );
      break;
    case "target":
      content = <TargetProgress {...body.props} />;
      break;
    case "map":
      content = (
        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="aspect-[4/3] max-h-[420px]">
            <ChoroplethInteractive
              id={`w-${model.id}-map`}
              shapes={body.shapes}
              fills={body.fills}
              tooltips={body.tooltips}
              title={body.mapTitle}
            />
          </div>
          <MapLegend
            id={`w-${model.id}`}
            title={body.unitLabel}
            classes={body.classes}
            rangeLabel={(item) =>
              `${formatValue(item.from, body.unitKind, tag)} – ${formatValue(item.to, body.unitKind, tag)}`
            }
            noData={{ label: ind("noData"), count: body.noData }}
          />
          <p className="text-muted-foreground text-xs md:col-span-2">{body.credit}</p>
        </div>
      );
      break;
    case "table":
      content = (
        <IndicatorTable
          caption={body.caption}
          rows={body.rows}
          periods={body.periods}
          rowHeader={t("columns.area")}
          unitKind={body.unitKind}
          tag={tag}
          flags={[]}
          emptyLabel={status("empty")}
          sortLabel={ind.raw("sortBy") as string}
        />
      );
      break;
    case "text":
      content = <Markdown source={body.body} />;
      break;
    case "empty":
      content = <p className="text-muted-foreground">{t("widgetEmpty")}</p>;
      break;
    case "error":
      content = <p role="alert">{t("widgetError")}</p>;
      break;
  }

  return (
    <WidgetShell
      id={model.id}
      title={model.title}
      span={model.span}
      table={model.table}
      explorerHref={model.explorerHref}
      labels={{
        menu: t("menu", { title: model.title }),
        viewData: t("viewData"),
        hideData: t("hideData"),
        downloadCsv: t("downloadCsv"),
        openExplorer: t("openExplorer"),
        copyLink: t("copyLink"),
        linkCopied: t("linkCopied"),
      }}
    >
      {content}
      {model.source && <p className="text-muted-foreground mt-3 text-xs">{model.source}</p>}
    </WidgetShell>
  );
}
