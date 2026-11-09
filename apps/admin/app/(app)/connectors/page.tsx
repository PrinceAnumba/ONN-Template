import { adminApi } from "@onn/api-client/admin";
import { can } from "@onn/api-client/permissions";
import { EmptyState } from "@onn/ui/components/empty-state";
import { EMPTY_VALUE } from "@onn/ui/format";
import { StatusPill } from "@onn/ui/components/status-pill";
import { PlugIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { RUN_TONE } from "@/lib/connectors";
import { cronText, type CronT } from "@/lib/cron-text";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { requireSession } from "@/lib/session";

/** Connectors (brief §7): each source with its schedule and last run. */
export default async function ConnectorsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.connectors");
  const cron = (await getTranslations("Admin.connectors.cron")) as unknown as CronT;
  const items = await adminApi.connectors({ locale, token: session.token }, session.activeOrg);
  const canManage = can(session.roles, "connector.manage");
  const newConnector = canManage ? (
    <Link
      href="/connectors/new"
      className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-md px-4 font-semibold"
    >
      {t("new")}
    </Link>
  ) : undefined;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-h1">{t("title")}</h1>
        {newConnector}
      </div>
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState icon={PlugIcon} message={t("empty")} action={newConnector} />
        ) : (
          <div className="relative overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="bg-surface-2">
                <tr>
                  {(["name", "org", "type", "schedule", "lastRun", "rows"] as const).map((key) => (
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
                {items.map((item) => (
                  <tr key={item.id} className="border-t align-top">
                    <th scope="row" className="p-3 text-start font-semibold">
                      <Link href={`/connectors/${item.id}`} className="underline">
                        {item.name}
                      </Link>
                      {!item.enabled && (
                        <span className="text-muted-foreground ms-2 text-xs font-normal">
                          {t("paused")}
                        </span>
                      )}
                    </th>
                    <td className="p-3">{item.orgName}</td>
                    <td className="p-3 whitespace-nowrap">{t(`type.${item.type}`)}</td>
                    <td className="p-3">
                      {cronText(item.schedule, cron, locale) ?? item.schedule}
                    </td>
                    <td className="p-3">
                      {item.lastRun ? (
                        <div className="flex flex-col items-start gap-1">
                          <StatusPill
                            tone={RUN_TONE[item.lastRun.status]}
                            label={t(`run.${item.lastRun.status}`)}
                          />
                          <span className="text-muted-foreground text-xs whitespace-nowrap">
                            {t("dateTime", {
                              date: formatDate(item.lastRun.date, locale, "medium"),
                              time: formatTime(item.lastRun.date, locale),
                            })}
                          </span>
                          {item.lastRun.error && (
                            <span className="text-destructive text-xs">{item.lastRun.error}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{t("never")}</span>
                      )}
                    </td>
                    <td className="p-3 tabular-nums">
                      {item.lastRun ? formatNumber(item.lastRun.rows, locale) : EMPTY_VALUE}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
