import type { IndicatorSummary } from "@onn/api-client/types";
import type { KpiCardProps } from "@onn/ui/components/kpi-card";
import { describeChange, formatPeriod, formatValue, unitIsInline } from "@onn/ui/format";
import type { getTranslations } from "next-intl/server";

type HomeTranslator = Awaited<ReturnType<typeof getTranslations<"Home">>>;

export const kindOf = (indicator: Pick<IndicatorSummary, "unitVariants">) =>
  indicator.unitVariants[0]?.code ?? "count";

/** KpiCard props for an indicator with a latest value (home key figures, area profiles). */
export function kpiCardProps(
  indicator: IndicatorSummary & { latest: NonNullable<IndicatorSummary["latest"]> },
  { tag, href, t }: { tag: string; href: string; t: HomeTranslator },
): KpiCardProps {
  const latest = indicator.latest;
  const kind = kindOf(indicator);
  const change = describeChange(latest.changePct, indicator.higherIsBetter);
  const changeText = formatValue(Math.abs(latest.changePct ?? 0), "pct", tag);
  return {
    href,
    label: indicator.name,
    value: formatValue(latest.value, kind, tag, { compact: true }),
    unit: unitIsInline(kind) ? undefined : indicator.unit,
    year: formatPeriod(latest.year, tag),
    source: indicator.source.org,
    sparkline: latest.sparkline,
    flag:
      latest.status === "E" || latest.status === "P"
        ? { symbol: latest.status.toLowerCase(), label: t(`flag.${latest.status}`) }
        : undefined,
    change: change && {
      text: changeText,
      direction: change.direction,
      tone: change.tone,
      description: t(`change.${change.direction}`, { change: changeText }),
    },
  };
}

export const hasLatest = (
  item: IndicatorSummary,
): item is IndicatorSummary & { latest: NonNullable<IndicatorSummary["latest"]> } =>
  Boolean(item.latest);
