import type { ConnectorRun } from "@onn/api-client/types";
import { StatusPill } from "@onn/ui/components/status-pill";
import { cn } from "@onn/ui/lib/utils";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { RUN_TONE } from "@/lib/connectors";
import { formatDate, formatTime } from "@/lib/format";

const LEVEL_CLASS = { info: "", warn: "font-semibold", error: "text-destructive" } as const;

/** Run history with logs (brief §7). Each log opens with <details>, so it works without JS. */
export async function RunHistory({ runs }: { runs: ConnectorRun[] }) {
  const t = await getTranslations("Admin.connectors");
  const locale = await getLocale();
  return (
    <section aria-labelledby="run-history" className="mt-8 rounded-lg border p-4 md:p-6">
      <h2 id="run-history" className="text-h3">
        {t("section.history")}
      </h2>
      {runs.length === 0 ? (
        <p className="mt-3">{t("historyEmpty")}</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {runs.map((run) => {
            const seconds = Math.round(
              (new Date(run.finished).getTime() - new Date(run.started).getTime()) / 1000,
            );
            return (
              <li key={run.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <StatusPill tone={RUN_TONE[run.status]} label={t(`run.${run.status}`)} />
                  <span className="font-semibold">
                    {t("dateTime", {
                      date: formatDate(run.started, locale, "medium"),
                      time: formatTime(run.started, locale),
                    })}
                  </span>
                  <span className="text-muted-foreground">
                    {run.by ? t("trigger.manual", { name: run.by.name }) : t("trigger.schedule")}
                  </span>
                  <span>{t("runRows", { count: run.rows })}</span>
                  <span className="text-muted-foreground">{t("duration", { seconds })}</span>
                  {run.submission && (
                    <Link href={`/submissions/${run.submission}`} className="underline">
                      {run.submission}
                    </Link>
                  )}
                </div>
                {run.error && <p className="text-destructive mt-2 text-sm">{run.error}</p>}
                <details className="mt-2">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold underline">
                    {t("log", { id: run.id })}
                  </summary>
                  <ol className="bg-surface-2 mt-2 overflow-x-auto rounded-md p-3 font-mono text-xs">
                    {run.log.map((line, index) => (
                      <li key={index} className={cn("flex gap-3", LEVEL_CLASS[line.level])}>
                        <span className="text-muted-foreground shrink-0">
                          {formatTime(line.time, locale)}
                        </span>
                        <span className="w-14 shrink-0 uppercase">{t(`level.${line.level}`)}</span>
                        <span>{line.message}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
