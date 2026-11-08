"use client";

import { choropleth, type ClassMethod } from "@onn/charts/classify";
import { ChoroplethInteractive } from "@onn/charts/choropleth-interactive";
import { MapLegend } from "@onn/charts/map-legend";
import { country } from "@onn/config";
import { chartTokens } from "@onn/config/tokens";
import { DisaggregationTabs } from "@onn/ui/components/disaggregation-tabs";
import { Button } from "@onn/ui/components/ui/button";
import { YearSlider } from "@onn/ui/components/year-slider";
import { formatValue, unitIsInline } from "@onn/ui/format";
import { cn } from "@onn/ui/lib/utils";
import { ListIcon, MapIcon, PauseIcon, PlayIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { usePathname } from "@/i18n/navigation";
import { tagFor } from "@/lib/format";
import { initialYear as initialYearIndex, rankAmong, yearSlice } from "@/lib/map";
import type { MapData } from "@/lib/map-view";
import { urlParsers } from "@/lib/url-state";
import { AreaPanel } from "./area-panel";

const AreaList = dynamic(() => import("./area-list"));
const BottomSheet = dynamic(
  () => import("@onn/ui/components/bottom-sheet").then((mod) => mod.BottomSheet),
  { ssr: false },
);
const ChoroplethMap = dynamic(
  () => import("@onn/charts/choropleth-map").then((mod) => mod.ChoroplethMap),
  { ssr: false },
);

const PLAY_INTERVAL_MS = 1200;
const SEPARATOR = " · ";
const METHODS: ClassMethod[] = ["quantile", "equal", "jenks"];
const OSM = {
  tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
};

function useWide() {
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

export interface MapExplorerProps {
  data: MapData;
  initialYear: number;
  /** The `a` parameter; preselected when it is on the current level. */
  focus: string | null;
  /**
   * overlay: the full-bleed map page, controls and panel over the map at ≥ 1024 px.
   * stacked: embedded in the indicator page, everything in one column.
   */
  layout: "overlay" | "stacked";
  heading: "h1" | "h2";
  initialList?: boolean;
}

/** Map page (brief §5.4), also embedded in the indicator page's map view. */
export function MapExplorer({
  data,
  initialYear,
  focus,
  layout,
  heading: Heading,
  initialList = false,
}: MapExplorerProps) {
  const t = useTranslations("Map");
  const locale = useLocale();
  const tag = tagFor(locale);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wide = useWide();
  const id = useId();
  const overlay = layout === "overlay";
  const [pending, startTransition] = useTransition();
  const [, setServerState] = useQueryStates(
    { l: urlParsers.l, a: urlParsers.a },
    { history: "push", shallow: false, scroll: false, startTransition },
  );
  const [, setLocalState] = useQueryStates(
    { y: urlParsers.y, v: urlParsers.v },
    { history: "replace", shallow: true, scroll: false },
  );

  const [yearIndex, setYearIndex] = useState(initialYear);
  const [method, setMethod] = useState<ClassMethod>("quantile");
  const [labels, setLabels] = useState(false);
  const [basemap, setBasemap] = useState(false);
  const [list, setList] = useState(initialList);
  const [playing, setPlaying] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const levelAreas = useMemo(
    () => data.areas.filter((area) => area.level === data.level),
    [data.areas, data.level],
  );
  const [selected, setSelected] = useState<string | undefined>(() =>
    levelAreas.some((area) => area.code === focus) ? (focus ?? undefined) : undefined,
  );
  const [announcement, setAnnouncement] = useState("");

  // A new level or indicator from the server brings new areas and years.
  useEffect(() => setYearIndex(initialYear), [initialYear]);
  // Keep the selection if it is still on the map, else adopt the focus (drilling into a child).
  useEffect(() => {
    const onLevel = (code?: string | null) => levelAreas.some((area) => area.code === code);
    setSelected((current) =>
      onLevel(current) ? current : onLevel(focus) ? (focus ?? undefined) : undefined,
    );
  }, [levelAreas, focus]);

  const year = data.years[yearIndex] ?? "";
  const levelLabel = data.levels.find((level) => level.key === data.level)?.label ?? data.level;
  const nameOf = (code: string) => data.areas.find((area) => area.code === code)?.name ?? code;
  const format = (value: number | null) => {
    const text = formatValue(value, data.indicator.unitKind, tag);
    return value === null || unitIsInline(data.indicator.unitKind)
      ? text
      : `${text} ${data.indicator.unitLabel}`;
  };

  const codes = useMemo(
    () => data.shapes?.shapes.map((shape) => shape.code) ?? levelAreas.map((area) => area.code),
    [data.shapes, levelAreas],
  );
  const slice = useMemo(
    () => yearSlice(codes, data.values, yearIndex),
    [codes, data.values, yearIndex],
  );
  const { fills, classes, noData } = useMemo(
    () => choropleth(slice, method, chartTokens.sequential),
    [slice, method],
  );
  const tooltips = Object.fromEntries(
    codes.map((code) => [
      code,
      t("tooltip", { name: nameOf(code), value: format(slice[code] ?? null) }),
    ]),
  );
  const title = t("mapTitle", { indicator: data.indicator.name, level: levelLabel, year });

  const changeYear = (index: number) => setYearIndex(index);
  const latestIndex = useMemo(() => initialYearIndex(data.years, data.values, null), [data]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setYearIndex((index) => {
        const next = Math.min(index + 1, data.years.length - 1);
        if (next === data.years.length - 1) setPlaying(false);
        return next;
      });
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, data.years.length]);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (year) setAnnouncement(t("showingYear", { year }));
    if (overlay && !playing) void setLocalState({ y: yearIndex === latestIndex ? null : year });
    // Announce and record the year once playback settles on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearIndex, playing]);

  const select = (code: string) => {
    setSelected(code);
    setAnnouncement(t("selected", { name: nameOf(code) }));
  };
  const toggleList = () => {
    setList(!list);
    if (overlay) void setLocalState({ v: list ? null : "table" });
  };
  const childHref = (child: string, level: string) => {
    if (!data.levels.some((item) => item.key === level)) return undefined;
    const params = new URLSearchParams(searchParams);
    params.set("l", level);
    params.set("a", child);
    return `${pathname}?${params}`;
  };

  const firstYear = Number(data.years[0]);
  const lastYear = Number(data.years.at(-1));
  const panelInOverlay = overlay && wide;
  const showSheet = overlay && wide === false && Boolean(selected);

  const panel = selected && (
    <AreaPanel
      code={selected}
      data={data}
      yearIndex={yearIndex}
      format={format}
      childHref={childHref}
      onSetFocus={(code) => void setServerState({ a: code })}
      showTitle={!showSheet}
    />
  );

  const controls = (
    <div className="flex flex-col gap-4">
      {data.levels.length > 1 && (
        <div className="flex flex-col gap-1">
          <span aria-hidden className="text-sm font-medium">
            {t("level")}
          </span>
          <DisaggregationTabs
            label={t("level")}
            options={data.levels.map((level) => ({ value: level.key, label: level.label }))}
            value={data.level}
            onValueChange={(level) =>
              void setServerState({ l: level === data.levels[0]?.key ? null : level })
            }
          />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-method`} className="text-sm font-medium">
          {t("classification")}
        </label>
        <select
          id={`${id}-method`}
          value={method}
          onChange={(event) => setMethod(event.target.value as ClassMethod)}
          className="bg-background h-11 rounded-md border px-3"
        >
          {METHODS.map((item) => (
            <option key={item} value={item}>
              {t(`methods.${item}`)}
            </option>
          ))}
        </select>
      </div>
      {data.years.length > 1 && (
        <div className="flex items-end gap-3">
          <Button
            variant="secondary"
            size="icon"
            aria-label={playing ? t("pause") : t("play")}
            onClick={() => {
              if (!playing && yearIndex === data.years.length - 1) setYearIndex(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
          </Button>
          <div className="min-w-0 flex-1">
            <YearSlider<[number]>
              label={t("year")}
              min={firstYear}
              max={lastYear}
              value={[Number(year)]}
              onValueChange={([next]) => {
                const index = data.years.indexOf(String(next));
                if (index >= 0) {
                  setPlaying(false);
                  changeYear(index);
                }
              }}
              thumbLabels={[t("year")]}
            />
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={labels}
            onChange={(event) => setLabels(event.target.checked)}
            className="accent-primary size-5"
          />
          {t("labels")}
        </label>
        {data.topology !== undefined && (
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={basemap}
              onChange={(event) => setBasemap(event.target.checked)}
              className="accent-primary size-5"
            />
            {t("basemap")}
          </label>
        )}
      </div>
      <Button variant="secondary" onClick={toggleList} aria-pressed={list}>
        {list ? <MapIcon aria-hidden /> : <ListIcon aria-hidden />}
        {list ? t("mapView") : t("listView")}
      </Button>
    </div>
  );

  const svgMap = data.shapes && (
    <ChoroplethInteractive
      id={`${id}-map`}
      shapes={data.shapes}
      fills={fills}
      title={title}
      tooltips={tooltips}
      selected={selected}
      onSelect={select}
      showLabels={labels}
    />
  );

  const rows = codes.map((code) => ({
    code,
    name: nameOf(code),
    value: slice[code] ?? null,
    rank:
      rankAmong(code, codes, data.values, yearIndex, data.indicator.higherIsBetter)?.rank ?? null,
  }));

  const mapArea = list ? (
    <AreaList
      caption={title}
      rows={rows}
      format={format}
      selected={selected}
      onSelect={select}
      labels={{
        area: t("area"),
        value: t("value"),
        rank: t("rank"),
        empty: t("noData"),
        sortBy: t.raw("sortBy") as string,
      }}
    />
  ) : !data.shapes ? (
    <p role="alert" className="bg-surface-2 rounded-lg p-6">
      {t("noBoundaries")}
    </p>
  ) : basemap && data.topology !== undefined ? (
    <ChoroplethMap
      topology={data.topology}
      codeProperty={country.geography.codeProperty}
      fills={fills}
      bbox={country.geography.bbox as [number, number, number, number]}
      selected={selected}
      onSelect={select}
      fallback={svgMap}
      height="100%"
      basemap={OSM}
    />
  ) : (
    svgMap
  );

  const legend = (
    <MapLegend
      id={`${id}-legend`}
      title={data.indicator.unitLabel}
      classes={classes}
      rangeLabel={(item) =>
        `${formatValue(item.from, data.indicator.unitKind, tag)} – ${formatValue(item.to, data.indicator.unitKind, tag)}`
      }
      noData={{ label: t("noData"), count: noData }}
    />
  );

  return (
    <div
      className={cn(
        "relative",
        overlay && "lg:h-[calc(100dvh-170px)] lg:min-h-[520px] lg:overflow-hidden",
      )}
    >
      {pending && (
        <div aria-hidden className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden">
          <div className="bg-brand h-full w-1/3 animate-pulse" />
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {pending ? t("updating") : announcement}
      </p>

      <div
        className={cn(
          "flex flex-col gap-3",
          overlay && "lg:absolute lg:inset-y-4 lg:start-4 lg:z-10 lg:w-80 lg:overflow-y-auto",
        )}
      >
        <section aria-label={t("options")} className="bg-card rounded-lg border p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Heading className="text-h3">{data.indicator.name}</Heading>
              <p className="text-muted-foreground text-sm">
                {levelLabel}
                {year && SEPARATOR}
                {year}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-expanded={optionsOpen}
              aria-controls={`${id}-options`}
              aria-label={t("options")}
              onClick={() => setOptionsOpen(!optionsOpen)}
              className={cn(overlay && "lg:hidden")}
            >
              {optionsOpen ? <XIcon aria-hidden /> : <SlidersHorizontalIcon aria-hidden />}
            </Button>
          </div>
          <div
            id={`${id}-options`}
            className={cn("mt-4", !optionsOpen && "hidden", overlay && "lg:block")}
          >
            {controls}
          </div>
        </section>
        <div className={cn("hidden", overlay && "lg:mt-auto lg:block")}>
          {legend}
          <p className="text-muted-foreground mt-2 text-xs">{data.source}</p>
        </div>
      </div>

      <div
        className={cn(
          "mt-3 h-[60dvh] min-h-[360px]",
          list && "h-auto min-h-0",
          overlay && "lg:absolute lg:inset-0 lg:mt-0 lg:h-auto lg:py-4 lg:ps-[352px] lg:pe-4",
          overlay && list && "lg:overflow-y-auto",
          panelInOverlay && selected && "lg:pe-[396px]",
        )}
      >
        {mapArea}
      </div>
      <p className="sr-only">{t("keyboardHint")}</p>

      <div className={cn("mt-3", overlay && "lg:hidden")}>{legend}</div>
      <p className={cn("text-muted-foreground mt-2 text-sm", overlay && "lg:hidden")}>
        {data.source} {t("sourceNote")}
      </p>

      {selected && panelInOverlay && (
        <aside className="bg-card absolute inset-y-4 end-4 z-10 w-[380px] overflow-y-auto rounded-lg border p-5 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("close")}
            onClick={() => setSelected(undefined)}
            className="float-end -mt-2 -me-2"
          >
            <XIcon aria-hidden />
          </Button>
          {panel}
        </aside>
      )}
      {selected && !overlay && (
        <aside className="bg-card mt-4 rounded-lg border p-5">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("close")}
            onClick={() => setSelected(undefined)}
            className="float-end -mt-2 -me-2"
          >
            <XIcon aria-hidden />
          </Button>
          {panel}
        </aside>
      )}
      {showSheet && selected && (
        <BottomSheet
          open
          onOpenChange={(open) => !open && setSelected(undefined)}
          title={nameOf(selected)}
          closeLabel={t("close")}
          handleLabel={t("handle")}
          modal={false}
        >
          {panel}
        </BottomSheet>
      )}
    </div>
  );
}
