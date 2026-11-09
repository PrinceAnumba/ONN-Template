import { api } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { can } from "@onn/api-client/permissions";
import type { IndicatorStatus } from "@onn/api-client/types";
import { EmptyState } from "@onn/ui/components/empty-state";
import { PageSizeLinks, Pagination } from "@onn/ui/components/pagination";
import { StatusPill } from "@onn/ui/components/status-pill";
import { ListIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatDate, formatNumber } from "@/lib/format";
import { INDICATOR_STATUSES, INDICATOR_TONE } from "@/lib/indicators";
import { requireSession } from "@/lib/session";
import { PAGE_SIZES } from "@/lib/submissions";

const FIELD = "border-input bg-background h-11 rounded-md border px-3";

interface IndicatorsProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    pillar?: string;
    sort?: string;
    page?: string;
    size?: string;
  }>;
}

/** Indicator referential (brief §7): status and prioritisation score for every indicator. */
export default async function IndicatorsPage({ searchParams }: IndicatorsProps) {
  const params = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.indicators");
  const common = await getTranslations("Common");
  const status = INDICATOR_STATUSES.find((item) => item === params.status);
  const sort = params.sort === "priority" ? "priority" : "code";
  const pageSize = PAGE_SIZES.find((size) => String(size) === params.size) ?? PAGE_SIZES[0]!;
  const ctx = { locale, token: session.token };
  const [result, pillars] = await Promise.all([
    adminApi.indicators(ctx, {
      q: params.q?.trim() || undefined,
      status,
      pillar: params.pillar || undefined,
      sort,
      page: Number(params.page) || 1,
      pageSize,
    }),
    api.pillars({ locale }),
  ]);
  const pageCount = Math.max(1, Math.ceil(result.meta.total / result.meta.pageSize));
  const href = (changes: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    const next = {
      q: params.q?.trim(),
      status,
      pillar: params.pillar,
      sort: sort === "priority" ? "priority" : undefined,
      size: pageSize === PAGE_SIZES[0] ? undefined : String(pageSize),
      ...changes,
    };
    for (const [key, value] of Object.entries(next)) {
      if (value !== undefined && value !== "" && !(key === "page" && String(value) === "1")) {
        query.set(key, String(value));
      }
    }
    return query.size ? `/indicators?${query}` : "/indicators";
  };
  const filtered = Boolean(params.q?.trim() || status || params.pillar);
  const newIndicator = can(session.roles, "indicator.edit") ? (
    <Link
      href="/indicators/new"
      className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-md px-4 font-semibold"
    >
      {t("new")}
    </Link>
  ) : undefined;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-h1">{t("title")}</h1>
        {newIndicator}
      </div>

      <form action="/admin/indicators" method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="indicator-q" className="mb-1 block font-semibold">
            {t("filter.search")}
          </label>
          <input
            id="indicator-q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            className={`${FIELD} w-64 max-w-full`}
          />
        </div>
        <div>
          <label htmlFor="indicator-status" className="mb-1 block font-semibold">
            {t("filter.status")}
          </label>
          <select id="indicator-status" name="status" defaultValue={status ?? ""} className={FIELD}>
            <option value="">{t("filter.all")}</option>
            {INDICATOR_STATUSES.map((item) => (
              <option key={item} value={item}>
                {t(`status.${item}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="indicator-pillar" className="mb-1 block font-semibold">
            {t("filter.pillar")}
          </label>
          <select
            id="indicator-pillar"
            name="pillar"
            defaultValue={params.pillar ?? ""}
            className={`${FIELD} max-w-64`}
          >
            <option value="">{t("filter.all")}</option>
            {pillars.map((pillar) => (
              <option key={pillar.code} value={pillar.code}>
                {pillar.name}
              </option>
            ))}
          </select>
        </div>
        {sort === "priority" && <input type="hidden" name="sort" value="priority" />}
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-11 rounded-md px-4 font-semibold"
        >
          {common("apply")}
        </button>
        {filtered && (
          <Link href="/indicators" className="inline-flex h-11 items-center underline">
            {t("filter.clear")}
          </Link>
        )}
      </form>

      <p role="status" className="text-muted-foreground mt-4">
        {t("count", { count: result.meta.total })}
      </p>

      <div className="mt-2">
        {result.items.length === 0 ? (
          <EmptyState
            icon={ListIcon}
            message={t(filtered ? "emptyFiltered" : "empty")}
            action={newIndicator}
          />
        ) : (
          <div className="relative overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="bg-surface-2">
                <tr>
                  <th
                    scope="col"
                    className="p-3 text-start font-semibold"
                    aria-sort={sort === "code" ? "ascending" : undefined}
                  >
                    <Link href={href({ sort: undefined, page: undefined })} className="underline">
                      {t("column.code")}
                    </Link>
                  </th>
                  {(["name", "pillar", "status"] as const).map((key) => (
                    <th
                      key={key}
                      scope="col"
                      className="p-3 text-start font-semibold whitespace-nowrap"
                    >
                      {t(`column.${key}`)}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="p-3 text-start font-semibold whitespace-nowrap"
                    aria-sort={sort === "priority" ? "descending" : undefined}
                  >
                    <Link href={href({ sort: "priority", page: undefined })} className="underline">
                      {t("column.priority")}
                    </Link>
                  </th>
                  {(["periodicity", "org", "version", "updated"] as const).map((key) => (
                    <th
                      key={key}
                      scope="col"
                      className="p-3 text-start font-semibold whitespace-nowrap"
                    >
                      {t(`column.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.code} className="border-t">
                    <th
                      scope="row"
                      className="p-3 text-start font-mono font-semibold whitespace-nowrap"
                    >
                      <Link href={`/indicators/${item.code}`} className="underline">
                        {item.code}
                      </Link>
                    </th>
                    <td className="min-w-48 p-3">{item.name}</td>
                    <td className="p-3">{item.pillarName}</td>
                    <td className="p-3">
                      <StatusPill
                        tone={INDICATOR_TONE[item.status as IndicatorStatus]}
                        label={t(`status.${item.status}`)}
                      />
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">
                          {formatNumber(item.priority, locale, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                        </span>
                        <span
                          aria-hidden="true"
                          className="bg-surface-2 h-2 w-16 overflow-hidden rounded-pill"
                        >
                          <span
                            className="bg-primary block h-full"
                            style={{ width: `${(item.priority / 5) * 100}%` }}
                          />
                        </span>
                      </span>
                    </td>
                    <td className="p-3">{t(`periodicity.${item.periodicity}`)}</td>
                    <td className="p-3">{item.orgName}</td>
                    <td className="p-3 tabular-nums">{item.version}</td>
                    <td className="p-3 whitespace-nowrap">
                      {formatDate(item.updated, locale, "medium")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result.meta.total > PAGE_SIZES[0]! && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <PageSizeLinks
            sizes={PAGE_SIZES}
            current={result.meta.pageSize}
            href={(size) =>
              href({ size: size === PAGE_SIZES[0] ? undefined : size, page: undefined })
            }
            label={t("pageSize")}
            linkAs={Link}
          />
          <Pagination
            page={result.meta.page}
            pageCount={pageCount}
            href={(page) => href({ page })}
            labels={{
              nav: common("pagination"),
              previous: common("previous"),
              next: common("next"),
              page: common("pageN", { page: "{page}" }),
            }}
            linkAs={Link}
          />
        </div>
      )}
    </>
  );
}
