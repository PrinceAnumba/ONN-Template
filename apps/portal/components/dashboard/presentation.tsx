"use client";

import { buildOption } from "@onn/charts/options";
import { ChoroplethInteractive } from "@onn/charts/choropleth-interactive";
import { loadRuntime } from "@onn/charts/runtime";
import type { ChartSpec } from "@onn/charts/spec";
import { chartTokens } from "@onn/config/tokens";
import { Markdown } from "@onn/ui/components/markdown";
import { TargetProgress } from "@onn/ui/components/target-progress";
import { Button } from "@onn/ui/components/ui/button";
import { formatPeriod, formatValue } from "@onn/ui/format";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { WidgetModel } from "@/lib/dashboard";

const RATIO = 16 / 9;
const SWIPE_PX = 50;

export interface PresentationLabels {
  dialog: string;
  previous: string;
  next: string;
  exit: string;
  /** Templates with {n} and {total}, and {title} for the announcement. */
  count: string;
  announcement: string;
  keys: string;
}

export interface PresentationProps {
  slides: WidgetModel[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  logo: string;
  tag: string;
  labels: PresentationLabels;
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

/** A chart re-themed for the dark background, drawn by the same runtime as the page. */
function DarkChart({ spec }: { spec: ChartSpec }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let chart: ReturnType<Awaited<ReturnType<typeof loadRuntime>>["init"]> | undefined;
    let resize: ResizeObserver | undefined;
    let disposed = false;
    void loadRuntime(spec.kind).then((echarts) => {
      if (disposed || !ref.current) return;
      chart = echarts.init(ref.current, null, { renderer: "svg" });
      chart.setOption(buildOption(spec, { tokens: chartTokens, animate: false, dark: true }));
      resize = new ResizeObserver(() => chart?.resize());
      resize.observe(ref.current);
    });
    return () => {
      disposed = true;
      resize?.disconnect();
      chart?.dispose();
    };
  }, [spec]);
  return <div ref={ref} aria-hidden className="h-full w-full" />;
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground max-h-full w-full overflow-auto rounded-lg p-6">
      {children}
    </div>
  );
}

function SlideBody({ slide, tag }: { slide: WidgetModel; tag: string }) {
  const { body } = slide;
  switch (body.kind) {
    case "chart":
      return (
        <div role="img" aria-label={body.summary} className="h-full w-full">
          <DarkChart spec={body.spec} />
        </div>
      );
    case "kpi":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <p className="text-[length:calc(var(--type-display)*2)] leading-none font-bold">
            {body.card.value}
            {body.card.unit && <span className="text-h2 ms-3 font-normal">{body.card.unit}</span>}
          </p>
          <p className="text-h3 font-normal">{body.card.year}</p>
          {body.card.change && (
            <p className="text-h3 font-normal">{body.card.change.description}</p>
          )}
        </div>
      );
    case "target":
      return (
        <div className="flex h-full items-center">
          <Card>
            <TargetProgress {...body.props} />
          </Card>
        </div>
      );
    case "map":
      return (
        <Card>
          <div className="aspect-[4/3] max-h-[60dvh]">
            <ChoroplethInteractive
              id={`slide-${slide.id}`}
              shapes={body.shapes}
              fills={body.fills}
              tooltips={body.tooltips}
              title={body.mapTitle}
            />
          </div>
        </Card>
      );
    case "table":
      return (
        <Card>
          <table className="w-full">
            <caption className="sr-only">{body.caption}</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="p-2 text-start" />
                {body.periods.map((period) => (
                  <th key={period} scope="col" className="p-2 text-end">
                    {formatPeriod(period, tag)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <th scope="row" className="p-2 text-start font-normal">
                    {row.name}
                  </th>
                  {body.periods.map((period) => (
                    <td key={period} className="p-2 text-end tabular-nums">
                      {formatValue(row.cells[period]?.value ?? null, body.unitKind, tag)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      );
    case "text":
      return (
        <div className="flex h-full items-center">
          <Card>
            <Markdown source={body.body} className="text-h3" />
          </Card>
        </div>
      );
    default:
      return null;
  }
}

/**
 * Presentation mode (brief §5.5): one widget per 16:9 slide on the ink background. Arrow keys,
 * PageUp/PageDown, space and swipe move between slides; Esc exits. The caller enters fullscreen
 * from its click handler (browsers require a user gesture); without it this is a fixed overlay.
 */
export default function Presentation({
  slides,
  index,
  onIndexChange,
  onClose,
  logo,
  tag,
  labels,
}: PresentationProps) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const swipe = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const slide = slides[index];
  const total = slides.length;
  const go = (next: number) => onIndexChange(Math.min(Math.max(next, 0), total - 1));

  useEffect(() => {
    root.current?.focus();
    // Fullscreen starts asynchronously; leaving it (Esc in most browsers) ends the presentation.
    let entered = Boolean(document.fullscreenElement);
    const onFullscreen = () => {
      if (document.fullscreenElement) entered = true;
      else if (entered) onClose();
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.body.style.overflow = overflow;
    };
    // Mount and unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(event.key)) go(index + 1);
      else if (["ArrowLeft", "PageUp"].includes(event.key)) go(index - 1);
      else if (event.key === "Home") go(0);
      else if (event.key === "End") go(total - 1);
      else if (event.key === "Escape") onClose();
      else return;
      // Buttons inside keep their own Enter/Space; space advances only on the stage.
      if (event.key === " " && event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Fit a 16:9 slide inside the stage.
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const fitted = Math.min(width, height * RATIO);
      setSize({ width: fitted, height: fitted / RATIO });
    });
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  if (!slide) return null;
  const count = fill(labels.count, { n: index + 1, total });

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={labels.dialog}
      tabIndex={-1}
      onPointerDown={(event) => (swipe.current = event.clientX)}
      onPointerUp={(event) => {
        if (swipe.current === null) return;
        const dx = event.clientX - swipe.current;
        swipe.current = null;
        if (Math.abs(dx) > SWIPE_PX) go(index + (dx < 0 ? 1 : -1));
      }}
      className="bg-foreground fixed inset-0 z-[60] flex flex-col p-4 text-white outline-none md:p-8"
    >
      <p aria-live="polite" className="sr-only">
        {fill(labels.announcement, { n: index + 1, total, title: slide.title })}
      </p>
      <p className="sr-only">{labels.keys}</p>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-slide">{slide.title}</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.exit}
          onClick={onClose}
          className="shrink-0 text-white hover:bg-white/10"
        >
          <XIcon aria-hidden />
        </Button>
      </div>

      <div ref={stage} className="my-4 flex min-h-0 flex-1 items-center justify-center">
        <div style={{ width: size.width, height: size.height }} className="relative">
          <SlideBody key={slide.id} slide={slide} tag={tag} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- the logo is a small static asset */}
        <img src={logo} alt="" className="h-8 w-auto brightness-0 invert" />
        <p className="min-w-0 flex-1 truncate text-sm">{slide.source}</p>
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.previous}
          disabled={index === 0}
          onClick={() => go(index - 1)}
          className="text-white hover:bg-white/10"
        >
          <ChevronLeftIcon aria-hidden className="rtl:rotate-180" />
        </Button>
        <p className="text-sm tabular-nums">{count}</p>
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.next}
          disabled={index === total - 1}
          onClick={() => go(index + 1)}
          className="text-white hover:bg-white/10"
        >
          <ChevronRightIcon aria-hidden className="rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
