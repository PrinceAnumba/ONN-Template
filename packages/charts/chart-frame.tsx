"use client";

import { chartTokens } from "@onn/config/tokens";
import { formatValue } from "@onn/ui/format";
import { Button } from "@onn/ui/components/ui/button";
import { cn } from "@onn/ui/lib/utils";
import { DownloadIcon, Share2Icon, CodeIcon, TableIcon } from "lucide-react";
import * as React from "react";
import { exportPng, downloadText } from "./export";
import { buildOption } from "./options";
import { loadRuntime } from "./runtime";
import type { ChartSpec, ChartTable } from "./spec";
import { tableToCsv } from "./table";

export interface ChartFrameLabels {
  download: string;
  png: string;
  svg: string;
  csv: string;
  share: string;
  embed: string;
  viewTable: string;
  hideTable: string;
  copied: string;
  error: string;
  retry: string;
  empty: string;
}

export interface ChartFrameProps {
  title: string;
  subtitle?: string;
  /** "Source: {org}, {method}. Last updated {date}." */
  source?: string;
  /** Generated description, used as the chart's accessible name (brief §6). */
  summary: string;
  labels: ChartFrameLabels;
  status?: "ready" | "loading" | "error" | "empty";
  /** Keeps the old chart and shows a progress line (brief §8). */
  refetching?: boolean;
  onRetry?: () => void;
  spec?: ChartSpec;
  /** Server-rendered SVG, shown until hydration and always in Lite mode. */
  svg?: { desktop: string; mobile: string };
  table?: ChartTable;
  height?: number;
  mobileHeight?: number;
  /** No hydration: static SVG and table only (Lite mode). */
  lite?: boolean;
  shareUrl?: string;
  embedUrl?: string;
  logoUrl?: string;
  fileName?: string;
  /** Optional view switch, e.g. absolute / 100 % on a stacked bar. */
  toggle?: { label: string; options: { value: string; label: string }[]; field: "mode" };
  className?: string;
}

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
  }, []);
  return reduced;
}

function Menu({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        <DownloadIcon aria-hidden />
        {label}
      </Button>
      {open && (
        <ul className="bg-popover absolute end-0 z-30 mt-1 min-w-36 rounded-md border p-1 shadow-md">
          {children(() => setOpen(false))}
        </ul>
      )}
    </div>
  );
}

export function ChartFrame({
  title,
  subtitle,
  source,
  summary,
  labels,
  status = "ready",
  refetching,
  onRetry,
  spec,
  svg,
  table,
  height = 420,
  mobileHeight = 300,
  lite,
  shareUrl,
  embedUrl,
  logoUrl,
  fileName = "chart",
  toggle,
  className,
}: ChartFrameProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const instance = React.useRef<import("echarts/core").ECharts | null>(null);
  const [near, setNear] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [showTable, setShowTable] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [variant, setVariant] = React.useState<string | undefined>(toggle?.options[0]?.value);
  const reducedMotion = useReducedMotion();
  const id = React.useId();

  const activeSpec = React.useMemo(
    () => (spec && toggle && variant ? ({ ...spec, [toggle.field]: variant } as ChartSpec) : spec),
    [spec, toggle, variant],
  );

  // Hydrate when the frame comes within 200 px of the viewport (brief §6).
  React.useEffect(() => {
    if (lite || status !== "ready" || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && setNear(true),
      { rootMargin: "200px" },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [lite, status]);

  React.useEffect(() => {
    if (!near || !activeSpec || !chartRef.current) return;
    let disposed = false;
    let resize: ResizeObserver | undefined;
    void loadRuntime(activeSpec.kind).then((echarts) => {
      if (disposed || !chartRef.current) return;
      const chart = instance.current ?? echarts.init(chartRef.current, null, { renderer: "svg" });
      instance.current = chart;
      chart.setOption(
        buildOption(activeSpec, { tokens: chartTokens, animate: !reducedMotion && !hydrated }),
        { notMerge: true },
      );
      setHydrated(true);
      resize = new ResizeObserver(() => chart.resize());
      resize.observe(chartRef.current);
    });
    return () => {
      disposed = true;
      resize?.disconnect();
    };
    // hydrated only gates the first-render animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, activeSpec, reducedMotion]);

  React.useEffect(
    () => () => {
      instance.current?.dispose();
      instance.current = null;
    },
    [],
  );

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 3000);
  };

  const currentSvg = async () => {
    if (!activeSpec) return svg?.desktop ?? "";
    if (!instance.current) {
      const echarts = await loadRuntime(activeSpec.kind);
      const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 800, height });
      chart.setOption(buildOption(activeSpec, { tokens: chartTokens, animate: false }));
      const markup = chart.renderToSVGString();
      chart.dispose();
      return markup;
    }
    return instance.current.renderToSVGString();
  };

  const share = async () => {
    const url = shareUrl ?? window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    flash(labels.copied);
  };

  const embed = async () => {
    if (!embedUrl) return;
    const snippet = `<iframe src="${embedUrl}" title="${title.replaceAll('"', "&quot;")}" width="100%" height="${height + 120}" style="border:0"></iframe>`;
    await navigator.clipboard.writeText(snippet);
    flash(labels.copied);
  };

  const box = (content: React.ReactNode) => (
    <div className="flex h-[var(--chart-mobile)] items-center justify-center rounded-md md:h-[var(--chart-desktop)]">
      {content}
    </div>
  );

  const sizes = {
    "--chart-desktop": `${height}px`,
    "--chart-mobile": `${mobileHeight}px`,
  } as React.CSSProperties;

  return (
    <figure
      ref={containerRef}
      aria-labelledby={`${id}-title`}
      style={sizes}
      className={cn("bg-card relative rounded-lg border p-4", className)}
    >
      {refetching && (
        <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-lg">
          <div className="bg-brand h-full w-1/3 animate-pulse" />
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`${id}-title`}>{title}</h3>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
        {status === "ready" && (
          <div className="flex flex-wrap items-center gap-1">
            {toggle && (
              <div
                role="radiogroup"
                aria-label={toggle.label}
                className="bg-surface-2 flex rounded-md p-0.5"
              >
                {toggle.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={variant === option.value}
                    onClick={() => setVariant(option.value)}
                    className={cn(
                      "min-h-9 rounded-sm px-3 text-sm",
                      variant === option.value && "bg-background shadow-sm",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            <Menu label={labels.download}>
              {(close) => (
                <>
                  {activeSpec && (
                    <>
                      <li>
                        <button
                          type="button"
                          className="hover:bg-accent min-h-9 w-full rounded-sm px-3 text-start text-sm"
                          onClick={async () => {
                            close();
                            await exportPng({
                              svg: await currentSvg(),
                              title,
                              source,
                              logoUrl,
                              fileName,
                            });
                          }}
                        >
                          {labels.png}
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          className="hover:bg-accent min-h-9 w-full rounded-sm px-3 text-start text-sm"
                          onClick={async () => {
                            close();
                            downloadText(await currentSvg(), `${fileName}.svg`, "image/svg+xml");
                          }}
                        >
                          {labels.svg}
                        </button>
                      </li>
                    </>
                  )}
                  {table && (
                    <li>
                      <button
                        type="button"
                        className="hover:bg-accent min-h-9 w-full rounded-sm px-3 text-start text-sm"
                        onClick={() => {
                          close();
                          downloadText(tableToCsv(table), `${fileName}.csv`, "text/csv");
                        }}
                      >
                        {labels.csv}
                      </button>
                    </li>
                  )}
                </>
              )}
            </Menu>
            <Button variant="ghost" size="sm" onClick={share}>
              <Share2Icon aria-hidden />
              {labels.share}
            </Button>
            {embedUrl && (
              <Button variant="ghost" size="sm" onClick={embed}>
                <CodeIcon aria-hidden />
                {labels.embed}
              </Button>
            )}
            {table && (
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={showTable}
                onClick={() => setShowTable(!showTable)}
              >
                <TableIcon aria-hidden />
                {showTable ? labels.hideTable : labels.viewTable}
              </Button>
            )}
          </div>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {notice}
      </p>

      <div className="mt-3">
        {status === "loading" &&
          box(
            <div aria-hidden className="flex h-full w-full flex-col justify-between py-4">
              {[0, 1, 2].map((line) => (
                <div key={line} className="bg-border h-px w-full opacity-60" />
              ))}
            </div>,
          )}
        {status === "error" &&
          box(
            <div role="alert" className="text-center">
              <p>{labels.error}</p>
              {onRetry && (
                <Button variant="secondary" className="mt-3" onClick={onRetry}>
                  {labels.retry}
                </Button>
              )}
            </div>,
          )}
        {status === "empty" && box(<p className="text-muted-foreground">{labels.empty}</p>)}
        {status === "ready" && (
          <div
            role="img"
            aria-label={summary}
            className="relative h-[var(--chart-mobile)] md:h-[var(--chart-desktop)]"
          >
            {svg && !hydrated && (
              <>
                <div
                  aria-hidden
                  className="hidden h-full md:block"
                  dangerouslySetInnerHTML={{ __html: svg.desktop }}
                />
                <div
                  aria-hidden
                  className="h-full md:hidden"
                  dangerouslySetInnerHTML={{ __html: svg.mobile }}
                />
              </>
            )}
            {!lite && (
              <div
                ref={chartRef}
                aria-hidden
                className={cn("absolute inset-0", !hydrated && "invisible")}
              />
            )}
          </div>
        )}
      </div>

      {table && status === "ready" && (
        <table className={cn("mt-3 w-full text-sm", !showTable && "sr-only")}>
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              {table.columns.map((column, i) => (
                <th
                  key={column}
                  scope="col"
                  className={cn(
                    "border-b py-1 font-semibold",
                    table.numeric[i] ? "text-end" : "text-start",
                  )}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((value, c) =>
                  c === 0 ? (
                    <th key={c} scope="row" className="border-b py-1 text-start font-normal">
                      {value}
                    </th>
                  ) : (
                    <td key={c} className="border-b py-1 text-end tabular-nums">
                      {typeof value === "number" && activeSpec
                        ? formatValue(value, activeSpec.unitKind, activeSpec.tag)
                        : formatValue(null, "count", "en")}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {source && <figcaption className="text-muted-foreground mt-3 text-xs">{source}</figcaption>}
    </figure>
  );
}
