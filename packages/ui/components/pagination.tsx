import { cn } from "@onn/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export interface PaginationProps {
  page: number;
  pageCount: number;
  href: (page: number) => string;
  labels: {
    nav: string;
    previous: string;
    next: string;
    /** "Page {page}", filled per link. */
    page: string;
  };
  /** The app's link component (locale-aware); plain `<a>` by default. */
  linkAs?: ComponentType<{
    href: string;
    className?: string;
    children: ReactNode;
    "aria-label"?: string;
    "aria-current"?: "page";
  }>;
  className?: string;
}

/** Pages to show: first, last, current ± 1, with null for a gap. */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((item) => item >= 1 && item <= pageCount)
    .sort((a, b) => a - b);
  return shown.flatMap((item, i) => {
    const previous = shown[i - 1];
    if (previous === undefined || item - previous === 1) return [item];
    return item - previous === 2 ? [previous + 1, item] : [null, item];
  });
}

const ELLIPSIS = "…";

const ITEM =
  "inline-flex size-11 items-center justify-center rounded-md border font-semibold tabular-nums";

/** Server-safe pagination with plain links, so it works without JavaScript. */
export function Pagination({
  page,
  pageCount,
  href,
  labels,
  linkAs: LinkAs = "a" as unknown as NonNullable<PaginationProps["linkAs"]>,
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null;
  const pageLabel = (item: number) => labels.page.replace("{page}", String(item));
  return (
    <nav aria-label={labels.nav} className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {page > 1 ? (
            <LinkAs href={href(page - 1)} className={cn(ITEM, "w-auto gap-1 px-3")}>
              <ChevronLeftIcon aria-hidden className="size-4 rtl:rotate-180" />
              {labels.previous}
            </LinkAs>
          ) : (
            <span
              aria-disabled
              className={cn(ITEM, "text-muted-foreground w-auto gap-1 px-3 opacity-45")}
            >
              <ChevronLeftIcon aria-hidden className="size-4 rtl:rotate-180" />
              {labels.previous}
            </span>
          )}
        </li>
        {pageWindow(page, pageCount).map((item, i) =>
          item === null ? (
            <li key={`gap-${i}`} aria-hidden className="text-muted-foreground px-1">
              {ELLIPSIS}
            </li>
          ) : (
            <li key={item}>
              <LinkAs
                href={href(item)}
                aria-label={pageLabel(item)}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  ITEM,
                  item === page ? "bg-primary text-primary-foreground border-primary" : "bg-white",
                )}
              >
                {item}
              </LinkAs>
            </li>
          ),
        )}
        <li>
          {page < pageCount ? (
            <LinkAs href={href(page + 1)} className={cn(ITEM, "w-auto gap-1 px-3")}>
              {labels.next}
              <ChevronRightIcon aria-hidden className="size-4 rtl:rotate-180" />
            </LinkAs>
          ) : (
            <span
              aria-disabled
              className={cn(ITEM, "text-muted-foreground w-auto gap-1 px-3 opacity-45")}
            >
              {labels.next}
              <ChevronRightIcon aria-hidden className="size-4 rtl:rotate-180" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
