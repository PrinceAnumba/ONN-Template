import { ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { can } from "@onn/api-client/permissions";
import { StatusPill } from "@onn/ui/components/status-pill";
import { StatusStepper } from "@onn/ui/components/status-stepper";
import { cn } from "@onn/ui/lib/utils";
import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JustificationForm } from "@/components/submissions/justification-form";
import { RowsTable } from "@/components/submissions/rows-table";
import { SubmissionActions } from "@/components/submissions/submission-actions";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { availableActions, STATUS_TONE, STEPS } from "@/lib/submissions";

const TABS = ["data", "quality", "diff", "history"] as const;
type Tab = (typeof TABS)[number];

interface DetailProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: DetailProps) {
  return { title: decodeURIComponent((await params).id) };
}

/** Submission detail (brief §7): stepper, Data / Quality / Diff / History tabs, action bar. */
export default async function SubmissionPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.find((item) => item === requested) ?? "data";
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.submissions");
  const quality = await getTranslations("Admin.quality");
  const status = await getTranslations("Admin.status.submission");

  const item = await adminApi
    .submission({ locale, token: session.token }, decodeURIComponent(id))
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });

  const returned = item.status === "returned";
  const current = returned ? STEPS.indexOf("submitted") : STEPS.indexOf(item.status);
  const failing = item.quality.filter((rule) => rule.status === "fail");
  const errors = failing.filter((rule) => rule.level === "error");
  const warnings = failing.filter((rule) => rule.level === "warning");
  const canJustify =
    (item.status === "submitted" && can(session.roles, "submission.verify")) ||
    (["draft", "returned"].includes(item.status) && can(session.roles, "submission.submit"));
  const changed = item.rows.filter((row) => row.value !== row.published).length;
  const counts: Record<Tab, number | undefined> = {
    data: item.rows.length,
    quality: failing.length,
    diff: changed,
    history: item.history.length,
  };

  return (
    <>
      <Link href="/submissions" className="text-sm underline">
        {t("back")}
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 flex flex-wrap items-center gap-3">
            {item.id}
            <StatusPill tone={STATUS_TONE[item.status]} label={status(item.status)} />
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("summary", {
              org: item.orgName,
              period: item.period,
              channel: t(`channel.${item.channel}`),
              name: item.submittedBy.name,
            })}
          </p>
        </div>
        {item.channel === "entry" &&
          ["draft", "returned"].includes(item.status) &&
          can(session.roles, "submission.submit") &&
          item.indicators[0] && (
            <Link
              href={`/entry/${encodeURIComponent(item.indicators[0])}?period=${encodeURIComponent(item.period)}`}
              className="inline-flex min-h-11 items-center font-semibold underline"
            >
              {t("editEntry")}
            </Link>
          )}
        <SubmissionActions
          id={item.id}
          actions={availableActions(session.roles, item.status)}
          ownSubmission={item.submittedBy.id === session.user.id}
        />
      </div>

      <StatusStepper
        className="mt-6"
        steps={STEPS.map((step) => status(step))}
        current={current}
        returnedLabel={returned ? status("returned") : undefined}
        label={t("progress")}
        doneLabel={t("stepDone")}
        currentLabel={t("stepCurrent")}
      />

      <nav aria-label={t("tabsLabel2")} className="mt-8 overflow-x-auto border-b">
        <ul className="flex min-w-max gap-1">
          {TABS.map((key) => (
            <li key={key}>
              <Link
                href={
                  key === "data" ? `/submissions/${item.id}` : `/submissions/${item.id}?tab=${key}`
                }
                aria-current={tab === key ? "page" : undefined}
                className={cn(
                  "-mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm",
                  tab === key
                    ? "border-primary font-semibold"
                    : "text-muted-foreground border-transparent",
                )}
              >
                {t(`tab.${key}`)}
                <span className="rounded-pill bg-surface-2 px-2 text-xs tabular-nums">
                  {counts[key]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6">
        <h2 id="tab-heading" className="sr-only">
          {t(`tab.${tab}`)}
        </h2>

        {tab === "data" && (
          <>
            {(errors.length > 0 || warnings.length > 0) && (
              <p className="mb-4 text-sm">
                {t("issueSummary", { errors: errors.length, warnings: warnings.length })}{" "}
                <Link href={`/submissions/${item.id}?tab=quality`} className="underline">
                  {t("seeQuality")}
                </Link>
              </p>
            )}
            <RowsTable rows={item.rows} mode="data" />
          </>
        )}

        {tab === "quality" && (
          <div className="grid gap-8 lg:grid-cols-2">
            <ul className="divide-y rounded-lg border">
              {item.quality.map((result) => {
                const fail = result.status === "fail";
                const Icon = !fail
                  ? CircleCheckIcon
                  : result.level === "error"
                    ? CircleAlertIcon
                    : TriangleAlertIcon;
                return (
                  <li key={result.rule} className="flex items-start gap-3 p-4">
                    <Icon
                      aria-hidden
                      className={cn(
                        "mt-0.5 size-5 shrink-0",
                        !fail
                          ? "text-positive"
                          : result.level === "error"
                            ? "text-negative"
                            : "text-at-risk",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold">{quality(`rule.${result.rule}`)}</p>
                      <p className="text-muted-foreground text-sm">
                        {quality(`ruleHelp.${result.rule}`)}
                      </p>
                      <p className="mt-1 text-sm">
                        {fail
                          ? quality(result.level === "error" ? "failError" : "failWarning", {
                              count: result.rowIds.length,
                            })
                          : quality("pass")}
                      </p>
                      {fail && result.justification && !canJustify && (
                        <p className="bg-surface-2 mt-2 rounded-md p-2 text-sm">
                          {quality("justification", { text: result.justification })}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div>
              <h3 className="text-h3">{quality("justifyTitle")}</h3>
              {warnings.length === 0 ? (
                <p className="text-muted-foreground mt-2 text-sm">{quality("noWarnings")}</p>
              ) : canJustify ? (
                <>
                  <p className="text-muted-foreground mt-2 mb-4 text-sm">
                    {quality("justifyIntro")}
                  </p>
                  <JustificationForm id={item.id} warnings={warnings} />
                </>
              ) : (
                <p className="text-muted-foreground mt-2 text-sm">{quality("justifyReadOnly")}</p>
              )}
            </div>
          </div>
        )}

        {tab === "diff" && <RowsTable rows={item.rows} mode="diff" />}

        {tab === "history" && (
          <ol className="relative flex flex-col gap-6 border-s ps-6">
            {[...item.history].reverse().map((event) => (
              <li key={event.id} className="relative">
                <span
                  aria-hidden
                  className="bg-primary rounded-pill absolute -start-[1.95rem] top-1.5 size-3"
                />
                <p className="font-semibold">
                  {event.from
                    ? t("historyMove", { from: status(event.from), to: status(event.to) })
                    : t("historyCreated")}
                </p>
                <p className="text-muted-foreground text-sm">
                  {t("historyBy", {
                    name: event.actor.name,
                    date: formatDate(event.date, locale, "long"),
                  })}
                </p>
                {event.comment && (
                  <blockquote className="bg-surface-2 mt-2 rounded-md p-3 text-sm">
                    {event.comment}
                  </blockquote>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
