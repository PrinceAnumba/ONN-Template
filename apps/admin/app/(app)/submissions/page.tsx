import { adminApi } from "@onn/api-client/admin";
import { can } from "@onn/api-client/permissions";
import type { SubmissionChannel, SubmissionStatus } from "@onn/api-client/types";
import { EmptyState } from "@onn/ui/components/empty-state";
import { PageSizeLinks, Pagination } from "@onn/ui/components/pagination";
import { cn } from "@onn/ui/lib/utils";
import { InboxIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { SubmissionsTable } from "@/components/submissions/submissions-table";
import { requireSession } from "@/lib/session";
import { bulkActions, PAGE_SIZES, SUBMISSION_STATUSES } from "@/lib/submissions";

const CHANNELS: SubmissionChannel[] = ["import", "entry", "connector"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIELD = "border-input bg-background h-11 rounded-md border px-3";

interface ListProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Submissions (brief §7): status tabs, filters, selection with bulk actions, pagination. */
export default async function SubmissionsPage({ searchParams }: ListProps) {
  const params = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.submissions");
  const statusLabel = await getTranslations("Admin.status.submission");
  const common = await getTranslations("Common");

  const status = SUBMISSION_STATUSES.find((item) => item === params.status);
  const channel = CHANNELS.find((item) => item === params.channel);
  const q = params.q?.trim().slice(0, 100) || undefined;
  const from = params.from && DATE.test(params.from) ? params.from : undefined;
  const to = params.to && DATE.test(params.to) ? params.to : undefined;
  const pageSize = PAGE_SIZES.find((size) => String(size) === params.size) ?? PAGE_SIZES[0]!;
  const result = await adminApi.submissions(
    { locale, token: session.token },
    {
      status,
      channel,
      q,
      from,
      to,
      org: session.activeOrg,
      page: Number(params.page) || 1,
      pageSize,
    },
  );
  const pageCount = Math.max(1, Math.ceil(result.meta.total / result.meta.pageSize));
  const filtered = Boolean(q || channel || from || to);
  const canSubmit = can(session.roles, "submission.submit");

  /** The current URL with some parameters changed; defaults stay out of it. */
  const href = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      status,
      channel,
      q,
      from,
      to,
      size: params.size,
      page: params.page,
      ...changes,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (!value || (key === "page" && value === "1") || (key === "size" && value === "25"))
        continue;
      next.set(key, value);
    }
    const query = next.toString();
    return query ? `/submissions?${query}` : "/submissions";
  };
  const total = Object.values(result.counts).reduce((sum, n) => sum + n, 0);
  const tabs: { key?: SubmissionStatus; label: string; count: number }[] = [
    { label: t("tabAll"), count: total },
    ...SUBMISSION_STATUSES.map((key) => ({
      key,
      label: statusLabel(key),
      count: result.counts[key],
    })),
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-h1">{t("title")}</h1>
        {canSubmit && (
          <Link
            href="/imports/new"
            className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-md px-4 font-semibold"
          >
            {t("newImport")}
          </Link>
        )}
      </div>

      <nav aria-label={t("tabsLabel")} className="mt-6 overflow-x-auto border-b">
        <ul className="flex min-w-max gap-1">
          {tabs.map((tab) => {
            const active = tab.key === status;
            return (
              <li key={tab.key ?? "all"}>
                <Link
                  href={href({ status: tab.key, page: undefined })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm",
                    active
                      ? "border-primary font-semibold"
                      : "text-muted-foreground border-transparent",
                  )}
                >
                  {tab.label}
                  <span className="rounded-pill bg-surface-2 px-2 text-xs tabular-nums">
                    {tab.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* A GET form, so filters live in the URL and work without JavaScript. The plain form
          action needs the basePath. */}
      <form
        action="/admin/submissions"
        role="search"
        aria-label={t("filter.label")}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        {status && <input type="hidden" name="status" value={status} />}
        {params.size && <input type="hidden" name="size" value={params.size} />}
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label htmlFor="q" className="text-sm font-semibold">
            {t("filter.search")}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("filter.searchPlaceholder")}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="channel" className="text-sm font-semibold">
            {t("filter.channel")}
          </label>
          <select id="channel" name="channel" defaultValue={channel ?? ""} className={FIELD}>
            <option value="">{t("filter.anyChannel")}</option>
            {CHANNELS.map((item) => (
              <option key={item} value={item}>
                {t(`channel.${item}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-sm font-semibold">
            {t("filter.from")}
          </label>
          <input id="from" name="from" type="date" defaultValue={from} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-sm font-semibold">
            {t("filter.to")}
          </label>
          <input id="to" name="to" type="date" defaultValue={to} className={FIELD} />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-11 rounded-md px-4 font-semibold"
        >
          {common("apply")}
        </button>
        {filtered && (
          <Link
            href={href({
              q: undefined,
              channel: undefined,
              from: undefined,
              to: undefined,
              page: undefined,
            })}
            className="flex h-11 items-center px-2 underline"
          >
            {t("filter.clear")}
          </Link>
        )}
      </form>

      <p role="status" className="text-muted-foreground mt-4 text-sm">
        {t("resultCount", { count: result.meta.total })}
      </p>

      <div className="mt-2">
        {result.items.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            message={filtered || status ? t("emptyFiltered") : t("emptyAll")}
            action={
              canSubmit ? (
                <Link
                  href="/imports/new"
                  className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-md px-4 font-semibold"
                >
                  {t("newImport")}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <SubmissionsTable items={result.items} actions={bulkActions(session.roles)} />
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <PageSizeLinks
          sizes={PAGE_SIZES}
          current={result.meta.pageSize}
          href={(size) => href({ size: String(size), page: undefined })}
          label={t("pageSize")}
          linkAs={Link}
        />
        <Pagination
          page={result.meta.page}
          pageCount={pageCount}
          href={(page) => href({ page: String(page) })}
          labels={{
            nav: common("pagination"),
            previous: common("previous"),
            next: common("next"),
            page: common("pageN", { page: "{page}" }),
          }}
          linkAs={Link}
        />
      </div>
    </>
  );
}
