import { adminApi } from "@onn/api-client/admin";
import { can } from "@onn/api-client/permissions";
import { EmptyState } from "@onn/ui/components/empty-state";
import { PageSizeLinks, Pagination } from "@onn/ui/components/pagination";
import { StatusPill } from "@onn/ui/components/status-pill";
import { FileUpIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatDate, formatNumber } from "@/lib/format";
import { IMPORT_TONE } from "@/lib/imports";
import { requireSession } from "@/lib/session";
import { PAGE_SIZES } from "@/lib/submissions";

interface ImportsProps {
  searchParams: Promise<{ page?: string; size?: string }>;
}

/** Imports (brief §7 list pattern): every file uploaded for the user's organisations. */
export default async function ImportsPage({ searchParams }: ImportsProps) {
  const params = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.imports");
  const status = await getTranslations("Admin.status.import");
  const common = await getTranslations("Common");
  const pageSize = PAGE_SIZES.find((size) => String(size) === params.size) ?? PAGE_SIZES[0]!;
  const result = await adminApi.imports(
    { locale, token: session.token },
    { org: session.activeOrg, page: Number(params.page) || 1, pageSize },
  );
  const pageCount = Math.max(1, Math.ceil(result.meta.total / result.meta.pageSize));
  const canImport = can(session.roles, "submission.submit");
  const href = (page: number, size = pageSize) => {
    const query = new URLSearchParams();
    if (page > 1) query.set("page", String(page));
    if (size !== PAGE_SIZES[0]) query.set("size", String(size));
    return query.size ? `/imports?${query}` : "/imports";
  };
  const newImport = canImport ? (
    <Link
      href="/imports/new"
      className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-md px-4 font-semibold"
    >
      {t("new")}
    </Link>
  ) : undefined;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-h1">{t("title")}</h1>
        {newImport}
      </div>
      <div className="mt-6">
        {result.items.length === 0 ? (
          <EmptyState icon={FileUpIcon} message={t("empty")} action={newImport} />
        ) : (
          <div className="relative overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="bg-surface-2">
                <tr>
                  {(
                    ["id", "file", "org", "rows", "issues", "status", "by", "created"] as const
                  ).map((key) => (
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
                  <tr key={item.id} className="border-t">
                    <th scope="row" className="p-3 text-start font-semibold">
                      <Link href={`/imports/${item.id}`} className="underline">
                        {item.id}
                      </Link>
                    </th>
                    <td className="max-w-56 truncate p-3">{item.fileName}</td>
                    <td className="p-3">{item.orgName}</td>
                    <td className="p-3 tabular-nums">{formatNumber(item.rowCount, locale)}</td>
                    <td className="p-3 whitespace-nowrap">
                      {item.counts
                        ? t("issueCounts", {
                            errors: item.counts.errors,
                            warnings: item.counts.warnings,
                          })
                        : t("noCounts")}
                    </td>
                    <td className="p-3">
                      <StatusPill tone={IMPORT_TONE[item.status]} label={status(item.status)} />
                    </td>
                    <td className="p-3">{item.createdBy.name}</td>
                    <td className="p-3 whitespace-nowrap">
                      {formatDate(item.created, locale, "medium")}
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
            href={(size) => href(1, size)}
            label={t("pageSize")}
            linkAs={Link}
          />
          <Pagination
            page={result.meta.page}
            pageCount={pageCount}
            href={(page) => href(page)}
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
