import { PageSizeLinks, Pagination } from "@onn/ui/components/pagination";
import { cn } from "@onn/ui/lib/utils";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { PAGE_SIZES } from "@/lib/submissions";

/** Server-side pieces the list screens share (brief §7 list pattern). All work without JS. */

const PRIMARY_LINK =
  "bg-primary text-primary-foreground inline-flex h-11 items-center rounded-md px-4 font-semibold";

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={PRIMARY_LINK}>
      {children}
    </Link>
  );
}

/** Tabs that are links (`?tab=`), with the current one marked. */
export function TabLinks({
  label,
  tabs,
}: {
  label: string;
  tabs: { href: string; label: string; active: boolean; count?: number }[];
}) {
  return (
    <nav aria-label={label} className="mt-6 overflow-x-auto border-b">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "-mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm",
                tab.active
                  ? "border-primary font-semibold"
                  : "text-muted-foreground border-transparent",
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="bg-surface-2 text-foreground rounded-pill px-2 text-xs tabular-nums">
                  {tab.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A bordered, horizontally scrollable table with its header row. */
export function TableFrame({
  label,
  columns,
  children,
}: {
  label: string;
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div
      className="relative overflow-x-auto rounded-lg border"
      role="region"
      aria-label={label}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable table region
      tabIndex={0}
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-surface-2">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="p-3 text-start font-semibold whitespace-nowrap"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Page size links and pagination, shown once a list is longer than the smallest page. */
export async function ListPager({
  meta,
  href,
}: {
  meta: { total: number; page: number; pageSize: number };
  /** Builds a link from the changed parameters; `undefined` removes one. */
  href: (changes: { page?: number; size?: number }) => string;
}) {
  const common = await getTranslations("Common");
  const forms = await getTranslations("Admin.forms");
  if (meta.total <= PAGE_SIZES[0]!) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
      <PageSizeLinks
        sizes={PAGE_SIZES}
        current={meta.pageSize}
        href={(size) => href({ size: size === PAGE_SIZES[0] ? undefined : size })}
        label={forms("pageSize")}
        linkAs={Link}
      />
      <Pagination
        page={meta.page}
        pageCount={Math.max(1, Math.ceil(meta.total / meta.pageSize))}
        href={(page) =>
          href({ page, size: meta.pageSize === PAGE_SIZES[0] ? undefined : meta.pageSize })
        }
        labels={{
          nav: common("pagination"),
          previous: common("previous"),
          next: common("next"),
          page: common("pageN", { page: "{page}" }),
        }}
        linkAs={Link}
      />
    </div>
  );
}

/** A list address from its parameters, leaving out empty ones and page 1. */
export function listHref(base: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && !(key === "page" && String(value) === "1")) {
      query.set(key, String(value));
    }
  }
  return query.size ? `${base}?${query}` : base;
}

/** Classes for filter fields in a GET form. */
export const FILTER_FIELD = "border-input bg-background h-11 rounded-md border px-3";
