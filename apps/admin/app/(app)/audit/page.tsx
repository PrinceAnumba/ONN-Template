import { adminApi } from "@onn/api-client/admin";
import { EmptyState } from "@onn/ui/components/empty-state";
import { ScrollTextIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { VerifyChain } from "@/components/audit/verify-chain";
import { FILTER_FIELD, listHref, ListPager, TableFrame } from "@/components/list";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, diffJson } from "@/lib/governance";
import { requireSession } from "@/lib/session";
import { PAGE_SIZES } from "@/lib/submissions";

interface AuditProps {
  searchParams: Promise<{
    actor?: string;
    entity?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: string;
    size?: string;
  }>;
}

const DASH = "—";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const COLUMNS = ["seq", "date", "actor", "action", "entity", "id"] as const;

/**
 * Audit log (brief §7): who did what, newest first. Each entry's changes open in a `<details>`
 * under its row, so the diff reads without JavaScript.
 */
export default async function AuditPage({ searchParams }: AuditProps) {
  const params = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.audit");
  const forms = await getTranslations("Admin.forms");
  const common = await getTranslations("Common");
  const entity = AUDIT_ENTITIES.find((item) => item === params.entity);
  const action = AUDIT_ACTIONS.find((item) => item === params.action);
  const from = DAY.test(params.from ?? "") ? params.from : undefined;
  const to = DAY.test(params.to ?? "") ? params.to : undefined;
  const pageSize = PAGE_SIZES.find((size) => String(size) === params.size) ?? PAGE_SIZES[0]!;
  const result = await adminApi.audit(
    { locale, token: session.token },
    {
      actor: params.actor || undefined,
      entity,
      action,
      from,
      to,
      page: Number(params.page) || 1,
      pageSize,
    },
  );
  const actor = result.actors.find((item) => item.id === params.actor)?.id;
  const filtered = Boolean(actor || entity || action || from || to);
  const select = (
    name: "actor" | "entity" | "action",
    value: string | undefined,
    options: { value: string; label: string }[],
  ) => (
    <div>
      <label htmlFor={`audit-${name}`} className="mb-1 block font-semibold">
        {t(`filter.${name}`)}
      </label>
      <select
        id={`audit-${name}`}
        name={name}
        defaultValue={value ?? ""}
        className={`${FILTER_FIELD} max-w-56`}
      >
        <option value="">{forms("all")}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">{t("intro")}</p>
        </div>
        <VerifyChain />
      </div>
      <form action="/admin/audit" method="get" className="mt-6 flex flex-wrap items-end gap-3">
        {select(
          "actor",
          actor,
          result.actors.map((item) => ({ value: item.id, label: item.name })),
        )}
        {select(
          "entity",
          entity,
          AUDIT_ENTITIES.map((item) => ({ value: item, label: t(`entity.${item}`) })),
        )}
        {select(
          "action",
          action,
          AUDIT_ACTIONS.map((item) => ({ value: item, label: t(`action.${item}`) })),
        )}
        {(["from", "to"] as const).map((name) => (
          <div key={name}>
            <label htmlFor={`audit-${name}`} className="mb-1 block font-semibold">
              {t(`filter.${name}`)}
            </label>
            <input
              id={`audit-${name}`}
              name={name}
              type="date"
              defaultValue={(name === "from" ? from : to) ?? ""}
              className={FILTER_FIELD}
            />
          </div>
        ))}
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-11 rounded-md px-4 font-semibold"
        >
          {common("apply")}
        </button>
        {filtered && (
          <Link href="/audit" className="inline-flex h-11 items-center underline">
            {forms("clearFilters")}
          </Link>
        )}
      </form>
      <p role="status" className="text-muted-foreground mt-4">
        {t("count", { count: result.meta.total })}
      </p>
      <div className="mt-2">
        {result.items.length === 0 ? (
          <EmptyState icon={ScrollTextIcon} message={t(filtered ? "emptyFiltered" : "empty")} />
        ) : (
          <TableFrame label={t("title")} columns={COLUMNS.map((key) => t(`column.${key}`))}>
            {result.items.map((entry) => {
              const changes = diffJson(entry.before, entry.after);
              return [
                <tr key={entry.seq} className="border-t align-top">
                  <td className="p-3 tabular-nums">{formatNumber(entry.seq, locale)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {forms("dateTime", {
                      date: formatDate(entry.date, locale, "medium"),
                      time: formatTime(entry.date, locale),
                    })}
                  </td>
                  <td className="p-3 whitespace-nowrap">{entry.actor.name}</td>
                  <td className="p-3 whitespace-nowrap">{t(`action.${entry.action}`)}</td>
                  <td className="p-3 whitespace-nowrap">{t(`entity.${entry.entity}`)}</td>
                  <th scope="row" className="p-3 text-start font-semibold break-all">
                    {entry.entityId}
                  </th>
                </tr>,
                <tr key={`${entry.seq}-changes`}>
                  <td colSpan={COLUMNS.length} className="px-3 pb-3">
                    <details>
                      <summary className="inline-flex min-h-11 cursor-pointer items-center underline">
                        {t("changes", { count: changes.length, seq: entry.seq })}
                      </summary>
                      {changes.length > 0 && (
                        <table className="mt-2 w-full border-collapse text-sm">
                          <caption className="sr-only">
                            {t("changesCaption", { seq: entry.seq })}
                          </caption>
                          <thead>
                            <tr>
                              {(["field", "before", "after"] as const).map((key) => (
                                <th key={key} scope="col" className="p-2 text-start font-semibold">
                                  {t(`diff.${key}`)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {changes.map((change) => (
                              <tr key={change.path} className="border-t align-top">
                                <th scope="row" className="p-2 text-start font-normal break-all">
                                  <code>{change.path || t("diff.whole")}</code>{" "}
                                  <span className="text-muted-foreground">
                                    {t(`diff.${change.kind}`)}
                                  </span>
                                </th>
                                <td className="p-2 break-all">
                                  {change.before === undefined ? (
                                    <span aria-hidden="true">{DASH}</span>
                                  ) : (
                                    <del className="bg-surface-2 rounded-sm px-1 no-underline">
                                      {change.before}
                                    </del>
                                  )}
                                </td>
                                <td className="p-2 break-all">
                                  {change.after === undefined ? (
                                    <span aria-hidden="true">{DASH}</span>
                                  ) : (
                                    <ins className="border-positive rounded-sm border px-1 font-semibold no-underline">
                                      {change.after}
                                    </ins>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <p className="text-muted-foreground mt-2 text-xs break-all">
                        {t("hashes", { hash: entry.hash, prev: entry.prevHash })}
                      </p>
                    </details>
                  </td>
                </tr>,
              ];
            })}
          </TableFrame>
        )}
      </div>
      <ListPager
        meta={result.meta}
        href={({ page, size }) =>
          listHref("/audit", { actor, entity, action, from, to, size, page })
        }
      />
    </>
  );
}
