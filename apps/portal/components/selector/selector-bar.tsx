"use client";

import { country } from "@onn/config";
import { Button } from "@onn/ui/components/ui/button";
import { showToast } from "@onn/ui/components/toast";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { SelectorData } from "@/lib/selector-data";
import {
  findInvalidParams,
  routeFromPath,
  serializeUrlState,
  urlParsers,
  withoutParams,
} from "@/lib/url-state";
import { buildSelectorGroups, DASHBOARD_PREFIX, SelectorFields } from "./selector-fields";
import type { Selection } from "./selector-fields";

const SelectorSheet = dynamic(() => import("./selector-sheet"), { ssr: false });

export function SelectorBar({ data }: { data: SelectorData }) {
  const t = useTranslations("Selector");
  const common = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useQueryStates(
    { i: urlParsers.i, a: urlParsers.a, c: urlParsers.c },
    { history: "push", shallow: false },
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const sheetTrigger = useRef<HTMLButtonElement>(null);

  const route = routeFromPath(pathname);
  const selection: Selection = {
    indicator: route.dashboard
      ? `${DASHBOARD_PREFIX}${route.dashboard}`
      : (route.indicator ?? state.i?.[0] ?? null),
    area: state.a,
    comparison: state.c,
  };

  const groups = useMemo(() => buildSelectorGroups(data, locale, t), [data, locale, t]);

  const commit = (next: Selection) => {
    const params = { a: next.area, c: next.comparison };
    const value = next.indicator;
    const dashboard = value?.startsWith(DASHBOARD_PREFIX)
      ? value.slice(DASHBOARD_PREFIX.length)
      : null;

    if (dashboard || route.usesIndicatorRoute) {
      const base = pathname.split("/")[1];
      const path = dashboard ? `/dashboards/${dashboard}` : value ? `/data/${value}` : `/${base}`;
      const query = serializeUrlState(withoutParams(searchParams, ["i"]), params);
      router.push(`${path}${query}`, { scroll: false });
      return;
    }
    void setState({ ...params, i: value ? [value] : null });
  };

  const reset = () => {
    const base = pathname.split("/")[1];
    router.push(`/${base}`, { scroll: false });
  };

  const warned = useRef("");
  useEffect(() => {
    if (!data.indicators.length) return;
    const query = searchParams.toString();
    const invalid = findInvalidParams(searchParams, {
      indicators: new Set(data.indicators.map((item) => item.code)),
      areas: new Set(groups.focusCodes),
      comparisons: new Set(groups.comparisonCodes),
      levels: new Set(country.geography.levels.map((level) => level.key)),
    });
    if (!invalid.length || warned.current === query) return;
    warned.current = query;
    const kept = withoutParams(searchParams, invalid).toString();
    router.replace(`${pathname}${kept ? `?${kept}` : ""}`, { scroll: false });
    showToast(common("invalidLink"));
  }, [data, groups, searchParams, pathname, router, common]);

  const labelOf = (list: typeof groups.indicator, value: string | null) =>
    list.flatMap((group) => group.options).find((option) => option.value === value)?.label;
  const indicatorName = labelOf(groups.indicator, selection.indicator);
  const areaName = labelOf(groups.focus, selection.area) ?? country.name[locale];
  const comparisonName = labelOf(groups.comparison, selection.comparison);

  let announcement = t("showingArea", { area: areaName ?? "" });
  if (indicatorName) {
    announcement = comparisonName
      ? t("showingCompared", {
          indicator: indicatorName,
          area: areaName ?? "",
          comparison: comparisonName,
        })
      : t("showing", { indicator: indicatorName, area: areaName ?? "" });
  }

  return (
    <section aria-label={t("chooseData")} className="bg-surface-2 py-3">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="onn-container">
        <div className="hidden items-end gap-3 md:flex">
          <SelectorFields
            groups={groups}
            value={selection}
            onChange={commit}
            className="grid flex-1 grid-cols-3 gap-3"
          />
          <Button variant="ghost" onClick={reset} className="h-11 shrink-0">
            {common("reset")}
          </Button>
        </div>
        <Button
          ref={sheetTrigger}
          variant="outline"
          onClick={() => {
            setSheetMounted(true);
            setSheetOpen(true);
          }}
          className="rounded-pill h-11 w-full justify-start truncate md:hidden"
        >
          {indicatorName ? t("chooseDataWith", { name: indicatorName }) : t("chooseData")}
        </Button>
      </div>
      {sheetMounted && (
        <SelectorSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          groups={groups}
          value={selection}
          onClosed={() => sheetTrigger.current?.focus()}
          onApply={(next) => {
            commit(next);
            setSheetOpen(false);
          }}
        />
      )}
    </section>
  );
}
