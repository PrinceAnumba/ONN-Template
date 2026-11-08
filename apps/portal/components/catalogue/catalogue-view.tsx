"use client";

import type { Indicator } from "@onn/api-client/types";
import { DataTable, type DataTableColumn } from "@onn/ui/components/data-table";
import { EMPTY_VALUE } from "@onn/ui/format";
import type { MetadataDrawerProps } from "@onn/ui/components/metadata-drawer";
import { Button } from "@onn/ui/components/ui/button";
import { cn } from "@onn/ui/lib/utils";
import { Columns3Icon, FileSpreadsheetIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  activeFilterCount,
  catalogueSearch,
  COLUMNS,
  FACETS,
  facetCounts,
  parseCatalogue,
  filterRows,
  type CatalogueRow,
  type CatalogueState,
  type Column,
  type Facet,
} from "@/lib/catalogue";
import { useExportJob, type ExportLabels } from "@/lib/use-export-job";
import { StatusPill } from "./status-pill";

const MetadataDrawer = dynamic(
  () => import("@onn/ui/components/metadata-drawer").then((mod) => mod.MetadataDrawer),
  { ssr: false },
);

const COLUMNS_KEY = "onn-catalogue-columns";
const CHECK = "✓";
const TABLE_HEIGHT = 720;
/** Without JavaScript the mobile toggle can't open the facets, so they stay visible. */
const NO_JS_FACETS = "#catalogue-facets{display:block}";

export interface CatalogueViewProps {
  rows: CatalogueRow[];
  initial: CatalogueState;
  /** Display label per facet value, e.g. pillar code → name. Order is the facet's option order. */
  names: Record<Facet, Record<string, string>>;
  /** Full metadata for indicators without a page (in collection, planned). */
  details: Record<string, { indicator: Indicator; display: MetadataDrawerProps["display"] }>;
  metadataLabels: MetadataDrawerProps["labels"];
  exportLabels: ExportLabels;
}

/** Indicator catalogue (brief §5.8): facets, search, column chooser, XLSX export and the table. */
export function CatalogueView({
  rows,
  initial,
  names,
  details,
  metadataLabels,
  exportLabels,
}: CatalogueViewProps) {
  const t = useTranslations("Catalogue");
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hidden, setHidden] = useState<Column[]>([]);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [metadata, setMetadata] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const exportJob = useExportJob(exportLabels);
  const chooser = useRef<HTMLDivElement>(null);

  // Remembered per viewer; the page renders every column until this loads.
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? "[]") as Column[];
      setHidden(stored.filter((column) => COLUMNS.includes(column) && column !== "name"));
    } catch {
      // Storage blocked: keep every column.
    }
  }, []);

  useEffect(() => {
    const search = catalogueSearch(state);
    const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
    if (url !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [state]);

  useEffect(() => {
    if (!chooserOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!chooser.current?.contains(event.target as Node)) setChooserOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChooserOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [chooserOpen]);

  const visible = useMemo(() => filterRows(rows, state), [rows, state]);
  const active = activeFilterCount(state);

  const toggle = (facet: Facet, value: string, on: boolean) =>
    setState((current) => ({
      ...current,
      filters: {
        ...current.filters,
        [facet]: on
          ? [...current.filters[facet], value]
          : current.filters[facet].filter((item) => item !== value),
      },
    }));

  const toggleColumn = (column: Column, on: boolean) => {
    const next = on ? hidden.filter((item) => item !== column) : [...hidden, column];
    setHidden(next);
    try {
      localStorage.setItem(COLUMNS_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
  };

  const openMetadata = (code: string) => {
    setMetadata(code);
    setDrawerOpen(true);
  };

  const columns: (DataTableColumn<CatalogueRow> & { id: Column })[] = [
    { id: "code", header: t("columns.code"), value: (row) => row.code, width: 170 },
    {
      id: "name",
      header: t("columns.name"),
      value: (row) => row.name,
      width: 280,
      minWidth: 240,
      cell: (row) =>
        row.status === "published" ? (
          <Link href={`/data/${row.code}`} className="text-primary font-semibold underline">
            {row.name}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => openMetadata(row.code)}
            aria-label={t("openMetadata", { name: row.name })}
            className="text-primary text-start font-semibold underline"
          >
            {row.name}
          </button>
        ),
    },
    {
      id: "pillar",
      header: t("columns.pillar"),
      value: (row) => names.pillar[row.pillar] ?? row.pillar,
      width: 200,
      minWidth: 180,
    },
    { id: "unit", header: t("columns.unit"), value: (row) => row.unit, width: 140 },
    {
      id: "periodicity",
      header: t("columns.periodicity"),
      value: (row) => names.periodicity[row.periodicity] ?? row.periodicity,
      width: 130,
    },
    { id: "source", header: t("columns.source"), value: (row) => row.source, width: 200 },
    {
      id: "intl",
      header: t("columns.intl"),
      value: (row) => row.intl || null,
      width: 150,
    },
    {
      id: "sub",
      header: t("columns.sub"),
      value: (row) => names.sub[row.sub] ?? row.sub,
      width: 130,
      cell: (row) =>
        row.sub === "yes" ? (
          <span>
            <span aria-hidden>{CHECK}</span>
            <span className="sr-only">{names.sub.yes}</span>
          </span>
        ) : (
          <span>
            <span aria-hidden>{EMPTY_VALUE}</span>
            <span className="sr-only">{names.sub.no}</span>
          </span>
        ),
    },
    {
      id: "updated",
      header: t("columns.updated"),
      value: (row) => row.updated,
      cell: (row) => row.updatedLabel,
      width: 150,
    },
    {
      id: "status",
      header: t("columns.status"),
      value: (row) => names.status[row.status] ?? row.status,
      width: 150,
      cell: (row) => (
        <StatusPill status={row.status} label={names.status[row.status] ?? row.status} />
      ),
    },
  ];

  const detail = metadata ? details[metadata] : undefined;
  const exportParams = () => {
    const params = new URLSearchParams(catalogueSearch(state));
    params.set("columns", COLUMNS.filter((column) => !hidden.includes(column)).join(","));
    return Object.fromEntries(params);
  };

  return (
    <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
      <form
        method="get"
        role="search"
        aria-label={t("filters")}
        onSubmit={(event) => event.preventDefault()}
        className="contents"
      >
        <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-1">
          <label htmlFor={"catalogue-q"} className="font-semibold">
            {t("search")}
          </label>
          <div className="relative">
            <SearchIcon
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2"
            />
            <input
              id={"catalogue-q"}
              name="q"
              type="search"
              value={state.q}
              onChange={(event) => setState((current) => ({ ...current, q: event.target.value }))}
              placeholder={t("searchPlaceholder")}
              className="h-11 w-full rounded-md border bg-white ps-11 pe-3"
            />
          </div>
        </div>

        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Button
            type="button"
            variant="secondary"
            className="w-full lg:hidden"
            aria-expanded={filtersOpen}
            aria-controls={"catalogue-facets"}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontalIcon aria-hidden />
            {active ? t("filtersCount", { count: active }) : t("filters")}
          </Button>
          <noscript>
            <style>{NO_JS_FACETS}</style>
          </noscript>
          <div
            id={"catalogue-facets"}
            className={cn("mt-3 lg:mt-0 lg:block", !filtersOpen && "hidden")}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-h4">{t("filters")}</h2>
              {active > 0 && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() =>
                    setState((current) => ({
                      ...current,
                      filters: parseCatalogue({}).filters,
                    }))
                  }
                >
                  {t("clearAll")}
                </Button>
              )}
            </div>
            {FACETS.map((facet) => {
              const counts = facetCounts(rows, state, facet);
              return (
                <fieldset key={facet} className="mt-4 border-t pt-3">
                  <legend className="float-start mb-1 w-full pt-3 text-sm font-semibold">
                    {t(`facets.${facet}`)}
                  </legend>
                  <ul className="clear-both">
                    {Object.entries(names[facet]).map(([value, name]) => {
                      const checked = state.filters[facet].includes(value);
                      const count = counts.get(value) ?? 0;
                      return (
                        <li key={value}>
                          <label
                            className={cn(
                              "flex min-h-11 cursor-pointer items-center gap-3 text-sm",
                              !count && !checked && "text-muted-foreground",
                            )}
                          >
                            <input
                              type="checkbox"
                              name={facet}
                              value={value}
                              checked={checked}
                              onChange={(event) => toggle(facet, value, event.target.checked)}
                              className="accent-primary size-5 shrink-0"
                            />
                            <span className="min-w-0 flex-1">{name}</span>
                            <span className="text-muted-foreground tabular-nums">{count}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              );
            })}
            <noscript>
              <Button type="submit" className="mt-4 w-full">
                {t("apply")}
              </Button>
            </noscript>
          </div>
        </div>
      </form>

      <section aria-labelledby={"catalogue-results"} className="min-w-0 lg:col-start-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={"catalogue-results"} className="text-h4" role="status">
            {t("results", { count: visible.length })}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div ref={chooser} className="relative">
              <Button
                type="button"
                variant="secondary"
                aria-expanded={chooserOpen}
                aria-controls={"catalogue-columns"}
                onClick={() => setChooserOpen((open) => !open)}
              >
                <Columns3Icon aria-hidden />
                {t("columnChooser")}
              </Button>
              {chooserOpen && (
                <fieldset
                  id={"catalogue-columns"}
                  className="bg-popover absolute end-0 top-full z-20 mt-2 w-64 rounded-md border p-3 shadow-sm"
                >
                  <legend className="sr-only">{t("columnChooser")}</legend>
                  {COLUMNS.map((column) => (
                    <label
                      key={column}
                      className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={!hidden.includes(column)}
                        disabled={column === "name"}
                        onChange={(event) => toggleColumn(column, event.target.checked)}
                        className="accent-primary size-5"
                      />
                      {t(`columns.${column}`)}
                    </label>
                  ))}
                </fieldset>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              loading={exportJob.busy === "xlsx"}
              onClick={() => exportJob.run("xlsx", "catalogue", exportParams())}
            >
              <FileSpreadsheetIcon aria-hidden />
              {t("exportXlsx")}
            </Button>
          </div>
        </div>
        <p role="status" className="sr-only">
          {exportJob.status}
        </p>
        <DataTable
          className="mt-4"
          caption={t("caption")}
          columns={columns.filter((column) => !hidden.includes(column.id))}
          rows={visible}
          rowId={(row) => row.code}
          emptyLabel={t("empty")}
          maxHeight={TABLE_HEIGHT}
          sortLabel={(header) => t("sortBy", { column: header })}
        />
      </section>

      {detail && (
        <MetadataDrawer
          indicator={detail.indicator}
          display={detail.display}
          labels={metadataLabels}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onReportIssue={() => router.push(`/feedback?page=/catalogue#${detail.indicator.code}`)}
        />
      )}
    </div>
  );
}
