import { adminApi } from "@onn/api-client/admin";
import { EmptyState } from "@onn/ui/components/empty-state";
import { StatusPill } from "@onn/ui/components/status-pill";
import { TableIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { STATUS_TONE } from "@/lib/submissions";

interface EntryListProps {
  searchParams: Promise<{ q?: string }>;
}

/** Data entry (brief §7): the indicators the user's organisations report, with open drafts. */
export default async function EntryListPage({ searchParams }: EntryListProps) {
  const { q: raw } = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.entry");
  const status = await getTranslations("Admin.status.submission");
  const common = await getTranslations("Common");
  const q = raw?.trim().slice(0, 100) ?? "";
  const all = await adminApi.entryIndicators({ locale, token: session.token }, session.activeOrg);
  const items = all.filter(
    (item) => !q || `${item.code} ${item.name}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <h1 className="text-h1">{t("title")}</h1>
      <p className="text-muted-foreground mt-2 max-w-3xl">{t("intro")}</p>
      <form
        action="/admin/entry"
        role="search"
        aria-label={t("searchLabel")}
        className="mt-6 flex flex-wrap items-end gap-3"
      >
        <div className="flex min-w-48 flex-1 flex-col gap-1 sm:max-w-md">
          <label htmlFor="q" className="text-sm font-semibold">
            {t("search")}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            className="border-input bg-background h-11 rounded-md border px-3"
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-11 rounded-md px-4 font-semibold"
        >
          {common("apply")}
        </button>
      </form>
      <p role="status" className="text-muted-foreground mt-4 text-sm">
        {t("count", { count: items.length })}
      </p>
      <div className="mt-2">
        {items.length === 0 ? (
          <EmptyState icon={TableIcon} message={q ? t("emptyFiltered") : t("empty")} />
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((item) => (
              <li key={item.code} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {t("meta", {
                      code: item.code,
                      org: item.orgName,
                      unit: item.unit,
                      latest: item.latest ?? "",
                      hasLatest: item.latest ? "yes" : "no",
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {item.draft && (
                    <span className="flex items-center gap-2 text-sm">
                      <StatusPill
                        tone={STATUS_TONE[item.draft.status]}
                        label={status(item.draft.status)}
                      />
                      {t("draftUpdated", {
                        date: formatDate(item.draft.updated, locale, "medium"),
                      })}
                    </span>
                  )}
                  <Link
                    href={`/entry/${encodeURIComponent(item.code)}?period=${encodeURIComponent(item.next)}`}
                    aria-label={t("openLabel", { name: item.name, period: item.next })}
                    className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-md px-4 font-semibold"
                  >
                    {item.draft && ["draft", "returned"].includes(item.draft.status)
                      ? t("continue", { period: item.next })
                      : t("enter", { period: item.next })}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
