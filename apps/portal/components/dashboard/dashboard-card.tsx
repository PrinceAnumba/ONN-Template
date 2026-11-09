import { api, type RequestContext } from "@onn/api-client";
import type { Dashboard } from "@onn/api-client/types";
import { renderChartSvg } from "@onn/charts/ssr";
import { country } from "@onn/config";
import { Link } from "@/i18n/navigation";
import { tagFor } from "@/lib/format";
import { FallbackMark } from "@/components/fallback-mark";
import { fallbackLang } from "@/lib/localised";

/** 16:9 server-rendered thumbnail: the first indicator's national trend (brief §5.1, §5.5). */
export async function dashboardThumbnail(
  dashboard: Dashboard,
  ctx: RequestContext & { locale: string },
) {
  const widget = dashboard.widgets.find((item) => item.indicators.length > 0);
  if (!widget) return "";
  const series = await api
    .series(ctx, { indicator: widget.indicators[0]!, area: country.iso3 })
    .catch(() => []);
  return renderChartSvg(
    {
      kind: "line",
      tag: tagFor(ctx.locale),
      unitKind: "count",
      series: series
        .slice(0, 1)
        .map((item) => ({ name: "", role: "focus" as const, points: item.points })),
      labels: { period: "", breakInSeries: "", range: "", status: {} },
    },
    { width: 320, height: 180 },
  );
}

export function DashboardCard({
  dashboard,
  thumbnail,
  audience,
  heading: Heading = "h3",
}: {
  dashboard: Dashboard;
  thumbnail: string;
  audience: string;
  heading?: "h2" | "h3";
}) {
  return (
    <Link
      href={`/dashboards/${dashboard.slug}`}
      className="bg-card flex h-full flex-col overflow-hidden rounded-lg border transition-shadow duration-(--onn-dur-2) hover:shadow-sm"
    >
      <div
        aria-hidden
        className="bg-surface-2 aspect-video p-2"
        dangerouslySetInnerHTML={{ __html: thumbnail }}
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="rounded-pill text-muted-foreground self-start border px-2 text-xs">
          {audience}
        </span>
        <Heading className="text-h3" lang={fallbackLang(dashboard)}>
          {dashboard.title}
        </Heading>
        <p lang={fallbackLang(dashboard)} className="text-muted-foreground line-clamp-2 text-sm">
          {dashboard.description}
        </p>
        <FallbackMark item={dashboard} className="self-start" />
      </div>
    </Link>
  );
}
