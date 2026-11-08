"use client";

import { api } from "@onn/api-client";
import { country } from "@onn/config";
import { Sparkline } from "@onn/ui/components/sparkline";
import { Button, buttonVariants } from "@onn/ui/components/ui/button";
import { Skeleton } from "@onn/ui/components/skeleton";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { rankAmong } from "@/lib/map";
import type { MapData } from "@/lib/map-view";

const BREAKDOWNS = ["sex", "area"] as const;
type Breakdown = { dim: string; bars: { value: string; amount: number | null }[] };

// Breakdowns already fetched this visit, so reselecting an area is instant.
const cache = new Map<string, Promise<Breakdown>>();

function loadBreakdown(locale: string, indicator: string, area: string, dim: string, year: string) {
  const key = `${locale}|${indicator}|${area}|${dim}|${year}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = api
      .series({ locale }, { indicator, area, dims: `${dim}:*`, years: year })
      .then((series) => ({
        dim,
        bars: series.map((item) => ({
          value: item.dims[dim] ?? "",
          amount: [...item.points].reverse().find((point) => point.value !== null)?.value ?? null,
        })),
      }));
    entry.catch(() => cache.delete(key));
    cache.set(key, entry);
  }
  return entry;
}

export interface AreaPanelProps {
  code: string;
  data: MapData;
  yearIndex: number;
  format: (value: number | null) => string;
  /** Link to the same map one level down, focused on a child area. */
  childHref: (child: string, level: string) => string | undefined;
  onSetFocus: (code: string) => void;
  /** Hidden when the panel is the sheet, which shows the name as its own title. */
  showTitle?: boolean;
}

/** Selected area details (brief §5.4): value, rank, trend, breakdown, children and actions. */
export function AreaPanel({
  code,
  data,
  yearIndex,
  format,
  childHref,
  onSetFocus,
  showTitle = true,
}: AreaPanelProps) {
  const t = useTranslations("Map");
  const locale = useLocale();
  const area = data.areas.find((item) => item.code === code);
  const year = data.years[yearIndex] ?? "";
  const value = data.values[code]?.[yearIndex] ?? null;
  const levelLabel = data.levels.find((level) => level.key === data.level)?.label ?? data.level;
  const siblings = data.areas
    .filter((item) => item.level === data.level && item.parent === area?.parent)
    .map((item) => item.code);
  const rank = rankAmong(code, siblings, data.values, yearIndex, data.indicator.higherIsBetter);
  const children = data.areas.filter((item) => item.parent === code);
  const childLevel = children[0]?.level;
  const childLevelLabel = country.geography.levels.find((level) => level.key === childLevel)?.label[
    locale
  ];
  const dims = BREAKDOWNS.filter((dim) => data.indicator.disaggregations.includes(dim));

  const [breakdowns, setBreakdowns] = useState<Breakdown[] | "loading" | "error">("loading");
  useEffect(() => {
    if (!dims.length) return;
    let live = true;
    setBreakdowns("loading");
    Promise.all(dims.map((dim) => loadBreakdown(locale, data.indicator.code, code, dim, year)))
      .then((result) => live && setBreakdowns(result))
      .catch(() => live && setBreakdowns("error"));
    return () => {
      live = false;
    };
    // dims derives from the indicator, which the code and year already key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, data.indicator.code, code, year]);

  // Breakdowns are often published nationally only; hide the ones an area lacks.
  const shown = Array.isArray(breakdowns)
    ? breakdowns.filter((group) => group.bars.length > 0)
    : [];
  const dimLabel = (dim: string, item: string) =>
    t.has(`dimValues.${item}`) ? t(`dimValues.${item}` as "dimValues.female") : item;

  return (
    <div className="flex flex-col gap-5">
      <div>
        {showTitle && <h2 className="text-h3">{area?.name ?? code}</h2>}
        <p className="text-muted-foreground text-sm">{levelLabel}</p>
        <p className="mt-2 text-lg font-semibold">
          {value === null ? t("noValue", { year }) : t("valueIn", { value: format(value), year })}
        </p>
        {rank && (
          <p className="text-muted-foreground text-sm">
            {t("ranked", { rank: rank.rank, total: rank.total })}
          </p>
        )}
      </div>

      {(data.values[code]?.filter((item) => item !== null).length ?? 0) > 1 && (
        <div>
          <h3 className="text-sm font-semibold">{t("trend")}</h3>
          <Sparkline values={data.values[code] ?? []} className="mt-2" />
          <p className="text-muted-foreground flex justify-between text-xs tabular-nums">
            <span>{data.years[0]}</span>
            <span>{data.years.at(-1)}</span>
          </p>
        </div>
      )}

      {dims.length > 0 &&
        (breakdowns === "loading" || breakdowns === "error" || shown.length > 0) && (
          <div>
            <h3 className="text-sm font-semibold">{t("breakdown", { year })}</h3>
            {breakdowns === "loading" && (
              <div className="mt-2 flex flex-col gap-2" aria-busy>
                <span className="sr-only">{t("loadingBreakdown")}</span>
                {dims.map((dim) => (
                  <Skeleton key={dim} className="h-14 w-full" />
                ))}
              </div>
            )}
            {breakdowns === "error" && (
              <p role="alert" className="text-muted-foreground mt-2 text-sm">
                {t("breakdownError")}
              </p>
            )}
            {Array.isArray(breakdowns) &&
              shown.map((group) => {
                const max = Math.max(...group.bars.map((bar) => bar.amount ?? 0), 1);
                return (
                  <div key={group.dim} className="mt-3">
                    <p className="text-muted-foreground text-xs">
                      {t(`dims.${group.dim}` as "dims.sex")}
                    </p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {group.bars.map((bar) => (
                        <li
                          key={bar.value}
                          className="grid grid-cols-[5rem_1fr_auto] items-center gap-2 text-sm"
                        >
                          <span>{dimLabel(group.dim, bar.value)}</span>
                          <span aria-hidden className="bg-surface-2 h-3 rounded-sm">
                            <span
                              className="bg-brand block h-full rounded-sm"
                              style={{ width: `${((bar.amount ?? 0) / max) * 100}%` }}
                            />
                          </span>
                          <span className="tabular-nums">{format(bar.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        )}

      {children.length > 0 && childLevel && (
        <div>
          <h3 className="text-sm font-semibold">
            {t("children", { level: childLevelLabel ?? childLevel, name: area?.name ?? code })}
          </h3>
          <ul className="mt-1 flex flex-col">
            {children.map((child) => {
              const href = childHref(child.code, childLevel);
              return (
                <li key={child.code}>
                  {href ? (
                    <Link
                      href={href}
                      scroll={false}
                      className="flex min-h-11 items-center underline"
                    >
                      {child.name}
                    </Link>
                  ) : (
                    <span className="flex min-h-11 items-center">{child.name}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/data/${data.indicator.code}?a=${encodeURIComponent(code)}`}
          className={buttonVariants({ variant: "primary" })}
        >
          {t("openExplorer")}
        </Link>
        <Button variant="secondary" onClick={() => onSetFocus(code)}>
          {t("setFocus")}
        </Button>
      </div>
    </div>
  );
}
