"use client";

import type { DataQuery } from "@onn/api-client";
import { DisaggregationTabs } from "@onn/ui/components/disaggregation-tabs";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { YearSlider } from "@onn/ui/components/year-slider";
import { cn } from "@onn/ui/lib/utils";
import { CodeIcon, Share2Icon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect, useId, useState, useTransition } from "react";
import { DataDownloadMenu } from "@/components/data-download-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { yearParam } from "@/lib/indicator";
import { urlParsers, type VIEWS } from "@/lib/url-state";

type View = (typeof VIEWS)[number];

export interface ToolbarLabels {
  toolbar: string;
  view: string;
  views: Record<View, string>;
  unit: string;
  breakdown: string;
  years: string;
  fromYear: string;
  toYear: string;
  downloadData: string;
  formats: { csv: string; xlsx: string; json: string };
  downloadFailed: string;
  share: string;
  linkCopied: string;
  embed: string;
  embedCopied: string;
  updating: string;
}

export interface IndicatorToolbarProps {
  title: string;
  views: View[];
  view: View;
  units: { code: string; label: string }[];
  unit: string;
  breakdowns: { value: string; label: string; disabledReason?: string }[];
  breakdown: string;
  coverage: [number, number];
  range: [number, number];
  download: DataQuery;
  embedUrl: string;
  labels: ToolbarLabels;
}

/**
 * View, unit, breakdown and years for the indicator page (brief §5.3). Changes go to the URL and
 * re-render on the server; the old content stays visible under a progress line meanwhile (§8).
 */
export function IndicatorToolbar({
  title,
  views,
  view,
  units,
  unit,
  breakdowns,
  breakdown,
  coverage,
  range,
  download,
  embedUrl,
  labels,
}: IndicatorToolbarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [, setState] = useQueryStates(
    { u: urlParsers.u, d: urlParsers.d, y: urlParsers.y },
    { history: "push", shallow: false, scroll: false, startTransition },
  );
  const [years, setYears] = useState(range);
  const unitId = useId();

  // A new server render (back button, reset) brings a new range.
  useEffect(() => setYears(range), [range]);

  const viewHref = (next: View) => {
    const params = new URLSearchParams(searchParams);
    if (next === "chart") params.delete("v");
    else params.set("v", next);
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    showToast(labels.linkCopied);
  };

  const embed = async () => {
    const snippet = `<iframe src="${embedUrl}" title="${title.replaceAll('"', "&quot;")}" width="100%" height="540" style="border:0"></iframe>`;
    await navigator.clipboard.writeText(snippet);
    showToast(labels.embedCopied);
  };

  return (
    <section aria-label={labels.toolbar} className="relative mt-6 border-y py-4">
      {pending && (
        <div aria-hidden className="absolute inset-x-0 -top-px h-0.5 overflow-hidden">
          <div className="bg-brand h-full w-1/3 animate-pulse" />
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {pending ? labels.updating : ""}
      </p>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        {views.length > 1 && (
          <nav aria-label={labels.view}>
            <ul className="bg-surface-2 flex rounded-md p-1">
              {views.map((item) => (
                <li key={item}>
                  <Link
                    href={viewHref(item)}
                    scroll={false}
                    aria-current={item === view ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center rounded-sm px-4 text-sm font-medium",
                      item === view ? "bg-background shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {labels.views[item]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {units.length > 1 && (
          <div className="flex flex-col gap-1">
            <label htmlFor={unitId} className="text-sm font-medium">
              {labels.unit}
            </label>
            <select
              id={unitId}
              value={unit}
              onChange={(event) => {
                const next = event.target.value;
                void setState({ u: next === units[0]?.code ? null : next });
              }}
              className="bg-background h-11 rounded-md border px-3"
            >
              {units.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {breakdowns.length > 1 && (
          <div className="flex min-w-0 max-w-full flex-col gap-1">
            <span className="text-sm font-medium" aria-hidden>
              {labels.breakdown}
            </span>
            <DisaggregationTabs
              label={labels.breakdown}
              options={breakdowns}
              value={breakdown}
              onValueChange={(next) =>
                void setState({ d: next === "total" ? null : [`${next}:*`] })
              }
            />
          </div>
        )}

        {coverage[1] > coverage[0] && (
          <div className="flex w-full max-w-72 flex-col gap-1">
            <span className="text-sm font-medium" aria-hidden>
              {labels.years}
            </span>
            <YearSlider
              label={labels.years}
              min={coverage[0]}
              max={coverage[1]}
              value={years}
              onValueChange={setYears}
              onValueCommit={(next) => void setState({ y: yearParam(next, ...coverage) })}
              thumbLabels={[labels.fromYear, labels.toYear]}
              className="pt-5"
            />
          </div>
        )}

        <div className="ms-auto flex flex-wrap items-center gap-1">
          <DataDownloadMenu
            query={download}
            label={labels.downloadData}
            failed={labels.downloadFailed}
            fileName={download.indicator}
            formats={(["csv", "xlsx", "json"] as const).map((format) => ({
              format,
              label: labels.formats[format],
            }))}
          />
          <Button variant="ghost" size="md" onClick={() => void share()}>
            <Share2Icon aria-hidden />
            {labels.share}
          </Button>
          <Button variant="ghost" size="md" onClick={() => void embed()}>
            <CodeIcon aria-hidden />
            {labels.embed}
          </Button>
        </div>
      </div>
    </section>
  );
}
