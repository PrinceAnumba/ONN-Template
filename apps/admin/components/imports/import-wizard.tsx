"use client";

import type { ImportField, ImportFix, ImportIssue, ImportJob } from "@onn/api-client/types";
import { StatusStepper } from "@onn/ui/components/status-stepper";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { cn } from "@onn/ui/lib/utils";
import { CircleAlertIcon, DownloadIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { bff, BffError } from "@/lib/bff";
import { formatNumber } from "@/lib/format";
import { WIZARD_STEPS, type WizardStep } from "@/lib/imports";

const REQUIRED: ImportField[] = ["indicator", "area", "period", "value"];
const POLL_MS = 1000;
const FIELD = "border-input bg-background h-11 rounded-md border px-3";

function stepOf(job: ImportJob, submitting: boolean): WizardStep {
  if (job.status === "mapping") return "map";
  if (job.status === "validated" && submitting) return "submit";
  return "validate";
}

/** Quotes a CSV cell when needed. */
const csvCell = (text: string) => (/[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/** Steps 2–4 of the import wizard (brief §7), driven by the job's status. */
export function ImportWizard({ initial }: { initial: ImportJob }) {
  const t = useTranslations("Admin.imports");
  const [job, setJob] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const busy = job.status === "parsing" || job.status === "validating";

  // Poll while the server works (brief §7: `GET /admin/imports/{id}` (poll)).
  useEffect(() => {
    if (!busy) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      bff<ImportJob>(`/imports/${encodeURIComponent(job.id)}`, { signal: controller.signal })
        .then(setJob)
        .catch(() => {
          // Keep polling: a dropped request isn't a failed import.
          setJob((current) => ({ ...current }));
        });
    }, POLL_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [busy, job]);

  const step = stepOf(job, submitting);
  const done = job.status === "submitted";
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    // Move focus to the new step's heading so screen readers hear the change.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step, done]);

  if (job.status === "failed") {
    return (
      <div role="alert" className="border-destructive mt-8 max-w-2xl rounded-lg border-2 p-6">
        <h2 className="text-h3">{t("failedTitle")}</h2>
        <p className="mt-2">{t(`failed.${job.error ?? "format"}`)}</p>
        <Link
          href="/imports/new"
          className="mt-4 inline-flex min-h-11 items-center font-semibold underline"
        >
          {t("tryAnother")}
        </Link>
      </div>
    );
  }

  if (job.status === "submitted") {
    return (
      <div className="mt-8 max-w-2xl rounded-lg border p-6">
        <h2 ref={heading} tabIndex={-1} className="text-h3 outline-none">
          {t("submittedTitle")}
        </h2>
        <p className="mt-2">{t("submittedBody", { id: job.submission ?? "" })}</p>
        {job.submission && (
          <Link
            href={`/submissions/${job.submission}`}
            className="bg-primary text-primary-foreground mt-4 inline-flex h-11 items-center rounded-md px-4 font-semibold"
          >
            {t("openSubmission")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <StatusStepper
        className="mt-6"
        steps={WIZARD_STEPS.map((item) => t(`step.${item}`))}
        current={WIZARD_STEPS.indexOf(step)}
        label={t("progress")}
        doneLabel={t("stepDone")}
        currentLabel={t("stepCurrent")}
      />
      <section aria-labelledby="wizard-step" className="mt-8">
        <h2 id="wizard-step" ref={heading} tabIndex={-1} className="text-h2 outline-none">
          {t(`step.${step}`)}
        </h2>
        {busy ? (
          <p role="status" className="mt-4 flex items-center gap-2">
            <LoaderCircleIcon
              aria-hidden
              className="size-5 animate-spin motion-reduce:animate-none"
            />
            {t(job.status === "parsing" ? "parsing" : "validating")}
          </p>
        ) : step === "map" ? (
          <MapStep job={job} onDone={setJob} />
        ) : step === "validate" ? (
          <ValidateStep
            job={job}
            onChange={setJob}
            onBack={() => setJob({ ...job, status: "mapping" })}
            onContinue={() => setSubmitting(true)}
          />
        ) : (
          <SubmitStep job={job} onBack={() => setSubmitting(false)} />
        )}
      </section>
    </>
  );
}

function fieldLabel(
  t: ReturnType<typeof useTranslations>,
  dims: ReturnType<typeof useTranslations>,
  field: ImportField,
) {
  if (field.startsWith("dim:")) {
    const key = field.slice(4);
    return t("field.dim", { name: dims.has(key) ? dims(key) : key });
  }
  return t(`field.${field}`);
}

function MapStep({ job, onDone }: { job: ImportJob; onDone: (job: ImportJob) => void }) {
  const t = useTranslations("Admin.imports");
  const dims = useTranslations("Indicator.dims");
  const [columns, setColumns] = useState(() =>
    Object.fromEntries(job.columns.map((column) => [column.source, column.target])),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const label = (field: ImportField) => fieldLabel(t, dims, field);

  const submit = async () => {
    const chosen = Object.values(columns);
    const found = [
      ...REQUIRED.filter((field) => !chosen.includes(field)).map((field) =>
        t("map.missing", { field: label(field) }),
      ),
      ...[
        ...new Set(chosen.filter((field, i) => field !== "ignore" && chosen.indexOf(field) !== i)),
      ].map((field) => t("map.doubled", { field: label(field) })),
    ];
    setErrors(found);
    if (found.length) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setPending(true);
    try {
      onDone(
        await bff<ImportJob>(`/imports/${encodeURIComponent(job.id)}/mapping`, {
          method: "PUT",
          body: { columns },
        }),
      );
    } catch {
      showToast(t("map.failed"), "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4 grid gap-8">
      <p className="text-muted-foreground max-w-3xl">{t("map.intro")}</p>
      {errors.length > 0 && (
        <div
          ref={summary}
          tabIndex={-1}
          role="alert"
          className="border-destructive rounded-lg border-2 p-4 outline-none"
        >
          <p className="font-semibold">{t("map.errorTitle")}</p>
          <ul className="mt-2 list-disc ps-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="relative overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t("map.caption")}</caption>
          <thead className="bg-surface-2">
            <tr>
              <th scope="col" className="p-3 text-start">
                {t("map.column")}
              </th>
              <th scope="col" className="p-3 text-start">
                {t("map.field")}
              </th>
              <th scope="col" className="p-3 text-start">
                {t("map.sample")}
              </th>
            </tr>
          </thead>
          <tbody>
            {job.columns.map((column, index) => (
              <tr key={column.source} className="border-t">
                <th scope="row" className="p-3 text-start font-semibold">
                  {column.source}
                </th>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={t("map.selectLabel", { column: column.source })}
                      value={columns[column.source]}
                      onChange={(event) =>
                        setColumns({
                          ...columns,
                          [column.source]: event.target.value as ImportField,
                        })
                      }
                      className={cn(FIELD, "min-w-48")}
                    >
                      {job.targets.map((target) => (
                        <option key={target} value={target}>
                          {label(target)}
                        </option>
                      ))}
                    </select>
                    {column.auto && columns[column.source] === column.target && (
                      <span className="text-muted-foreground text-xs">{t("map.auto")}</span>
                    )}
                  </div>
                </td>
                <td className="text-muted-foreground max-w-64 truncate p-3">
                  {job.preview
                    .slice(0, 3)
                    .map((row) => row[index])
                    .filter(Boolean)
                    .join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-h3">{t("map.preview", { count: job.preview.length })}</h3>
        <div
          role="region"
          aria-label={t("map.preview", { count: job.preview.length })}
          className="relative mt-3 max-h-96 overflow-auto rounded-lg border"
          // A scroll region must be reachable by keyboard (axe scrollable-region-focusable).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t("map.preview", { count: job.preview.length })}</caption>
            <thead className="bg-surface-2 sticky top-0">
              <tr>
                <th scope="col" className="p-2 text-end">
                  {t("validate.row")}
                </th>
                {job.columns.map((column) => (
                  <th key={column.source} scope="col" className="p-2 text-start whitespace-nowrap">
                    <span className="block">{column.source}</span>
                    <span className="text-muted-foreground block text-xs font-normal">
                      {label(columns[column.source] ?? "ignore")}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {job.preview.map((row, r) => (
                <tr key={r} className="border-t">
                  <td className="text-muted-foreground p-2 text-end tabular-nums">{r + 1}</td>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className={cn(
                        "p-2 whitespace-nowrap",
                        columns[job.columns[c]?.source ?? ""] === "ignore" &&
                          "text-muted-foreground",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <Button onClick={() => void submit()} disabled={pending}>
          {t("map.submit")}
        </Button>
      </div>
    </div>
  );
}

function ValidateStep({
  job,
  onChange,
  onBack,
  onContinue,
}: {
  job: ImportJob;
  onChange: (job: ImportJob) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations("Admin.imports");
  const rule = useTranslations("Admin.imports.rule");
  const dims = useTranslations("Indicator.dims");
  const locale = useLocale();
  const id = useId();
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState(false);
  const counts = job.counts ?? { errors: 0, warnings: 0, valid: 0 };
  const issues = useMemo(
    () => (job.issues ?? []).filter((issue) => !errorsOnly || issue.level === "error"),
    [job.issues, errorsOnly],
  );
  const byRow = useMemo(() => {
    const map = new Map<number, ImportIssue[]>();
    for (const issue of issues) map.set(issue.row, [...(map.get(issue.row) ?? []), issue]);
    return [...map];
  }, [issues]);
  const columnIndex = (field: ImportField) =>
    job.columns.findIndex((column) => column.target === field);
  const editKey = (row: number, field: ImportField) => `${row}|${field}`;
  const dirty = Object.keys(edits).length > 0 || removed.size > 0;

  const apply = async () => {
    setPending(true);
    const fixes: ImportFix[] = Object.entries(edits).map(([key, value]) => {
      const [row, field] = key.split("|") as [string, ImportField];
      return { row: Number(row), field, value };
    });
    try {
      const next = await bff<ImportJob>(`/imports/${encodeURIComponent(job.id)}/rows`, {
        method: "PATCH",
        body: { fixes, remove: [...removed] },
      });
      setEdits({});
      setRemoved(new Set());
      onChange(next);
      showToast(
        next.counts?.errors
          ? t("validate.stillErrors", { count: next.counts.errors })
          : t("validate.fixed"),
        "info",
      );
    } catch (caught) {
      showToast(
        t(
          caught instanceof BffError && caught.status === 409
            ? "validate.stale"
            : "validate.failed",
        ),
        "error",
      );
    } finally {
      setPending(false);
    }
  };

  const downloadReport = () => {
    const header = [
      t("report.row"),
      t("report.field"),
      t("report.value"),
      t("report.level"),
      t("report.rule"),
    ];
    const lines = (job.issues ?? []).map((issue) => [
      String(issue.row),
      fieldLabel(t, dims, issue.field),
      issue.value,
      t(`level.${issue.level}`),
      rule(issue.rule),
    ]);
    const csv = [header, ...lines].map((cells) => cells.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob([`\ufeff${csv}\r\n`], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${job.id}-errors.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    { key: "rows", value: job.rowCount },
    { key: "valid", value: counts.valid },
    { key: "errors", value: counts.errors },
    { key: "warnings", value: counts.warnings },
  ] as const;

  return (
    <div className="mt-4 grid gap-6">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className={cn(
              "rounded-lg border p-4",
              stat.key === "errors" && stat.value > 0 && "border-negative border-2",
              stat.key === "warnings" && stat.value > 0 && "border-at-risk border-2",
            )}
          >
            <dt className="text-muted-foreground text-sm">{t(`validate.stat.${stat.key}`)}</dt>
            <dd className="text-h2 tabular-nums">{formatNumber(stat.value, locale)}</dd>
          </div>
        ))}
      </dl>

      {(job.issues ?? []).length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={errorsOnly}
                onChange={(event) => setErrorsOnly(event.target.checked)}
                className="accent-primary size-5"
              />
              {t("validate.errorsOnly")}
            </label>
            <Button variant="secondary" onClick={downloadReport}>
              <DownloadIcon aria-hidden className="size-4" />
              {t("validate.report")}
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">{t("validate.fixIntro")}</p>
          <div className="relative overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t("validate.caption")}</caption>
              <thead className="bg-surface-2">
                <tr>
                  <th scope="col" className="p-3 text-end">
                    {t("validate.row")}
                  </th>
                  <th scope="col" className="p-3 text-start">
                    {t("validate.problem")}
                  </th>
                  <th scope="col" className="p-3 text-start">
                    {t("validate.cell")}
                  </th>
                  <th scope="col" className="p-3 text-start">
                    {t("validate.remove")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {byRow.map(([row, rowIssues]) => {
                  const gone = removed.has(row);
                  const fields = [...new Set(rowIssues.map((issue) => issue.field))];
                  return (
                    <tr
                      key={row}
                      className={cn(
                        "border-t align-top",
                        gone && "text-muted-foreground line-through",
                      )}
                    >
                      <th scope="row" className="p-3 text-end font-semibold tabular-nums">
                        {row}
                      </th>
                      <td className="p-3">
                        <ul className="flex flex-col gap-1">
                          {rowIssues.map((issue) => (
                            <li
                              key={`${issue.field}-${issue.rule}`}
                              className="flex items-start gap-1.5"
                            >
                              {issue.level === "error" ? (
                                <CircleAlertIcon
                                  aria-hidden
                                  className="text-negative mt-0.5 size-4 shrink-0"
                                />
                              ) : (
                                <TriangleAlertIcon
                                  aria-hidden
                                  className="text-at-risk mt-0.5 size-4 shrink-0"
                                />
                              )}
                              <span>
                                <span className="sr-only">{t(`level.${issue.level}`)}</span>
                                {t("validate.issue", {
                                  field: fieldLabel(t, dims, issue.field),
                                  rule: rule(issue.rule),
                                })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-2">
                          {fields.map((field) => {
                            const original = job.rows?.[row - 1]?.[columnIndex(field)] ?? "";
                            const inputId = `${id}-${row}-${field}`;
                            return (
                              <div key={field} className="flex flex-col gap-1">
                                <label htmlFor={inputId} className="text-muted-foreground text-xs">
                                  {fieldLabel(t, dims, field)}
                                </label>
                                <input
                                  id={inputId}
                                  value={edits[editKey(row, field)] ?? original}
                                  disabled={gone}
                                  onChange={(event) =>
                                    setEdits({
                                      ...edits,
                                      [editKey(row, field)]: event.target.value,
                                    })
                                  }
                                  className={cn(FIELD, "w-44")}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="p-3">
                        <label className="flex min-h-11 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={gone}
                            onChange={(event) => {
                              const next = new Set(removed);
                              if (event.target.checked) next.add(row);
                              else next.delete(row);
                              setRemoved(next);
                            }}
                            className="accent-primary size-5"
                          />
                          <span className="sr-only">{t("validate.removeRow", { row })}</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="flex items-center gap-2">{t("validate.clean")}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={onBack} disabled={pending}>
          {t("validate.back")}
        </Button>
        {dirty && (
          <Button variant="secondary" onClick={() => void apply()} disabled={pending}>
            {t("validate.apply")}
          </Button>
        )}
        <Button
          onClick={() => counts.errors === 0 && !dirty && onContinue()}
          aria-disabled={counts.errors > 0 || dirty || undefined}
          aria-describedby={counts.errors > 0 || dirty ? `${id}-blocked` : undefined}
          className={counts.errors > 0 || dirty ? "cursor-not-allowed opacity-45" : undefined}
        >
          {t("validate.continue")}
        </Button>
        {(counts.errors > 0 || dirty) && (
          <p id={`${id}-blocked`} className="text-muted-foreground text-sm">
            {dirty ? t("validate.applyFirst") : t("validate.blocked", { count: counts.errors })}
          </p>
        )}
      </div>
    </div>
  );
}

function SubmitStep({ job, onBack }: { job: ImportJob; onBack: () => void }) {
  const t = useTranslations("Admin.imports");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const indicatorColumn = job.columns.findIndex((column) => column.target === "indicator");
  const periodColumn = job.columns.findIndex((column) => column.target === "period");
  const errorRows = new Set(
    (job.issues ?? []).filter((issue) => issue.level === "error").map((issue) => issue.row),
  );
  const live = (job.rows ?? []).filter((row, index) => row.length && !errorRows.has(index + 1));
  const indicators = [...new Set(live.map((row) => row[indicatorColumn] ?? ""))].filter(Boolean);
  const periods = [...new Set(live.map((row) => row[periodColumn] ?? ""))].filter(Boolean).sort();

  const submit = async () => {
    setPending(true);
    try {
      const result = await bff<{ submission: string }>(
        `/imports/${encodeURIComponent(job.id)}/submit`,
        {
          method: "POST",
          body: { comment: comment.trim() || undefined },
        },
      );
      showToast(t("submit.done", { id: result.submission }));
      router.push(`/submissions/${result.submission}`);
    } catch (caught) {
      setPending(false);
      showToast(
        t(
          caught instanceof BffError && caught.type === "errors"
            ? "submit.errors"
            : "submit.failed",
        ),
        "error",
      );
    }
  };

  const facts = [
    [t("submit.file"), job.fileName],
    [t("submit.org"), job.orgName],
    [t("submit.rows"), formatNumber(job.counts?.valid ?? 0, locale)],
    [t("submit.warnings"), formatNumber(job.counts?.warnings ?? 0, locale)],
    [t("submit.indicators"), indicators.join(", ")],
    [t("submit.periods"), periods.join(", ")],
  ];

  return (
    <div className="mt-4 grid max-w-3xl gap-6">
      <dl className="divide-y rounded-lg border">
        {facts.map(([term, value]) => (
          <div key={term} className="grid gap-1 p-4 sm:grid-cols-3">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="break-words sm:col-span-2">{value}</dd>
          </div>
        ))}
      </dl>
      {(job.counts?.warnings ?? 0) > 0 && <p className="text-sm">{t("submit.warningNote")}</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-comment`} className="font-semibold">
          {t("submit.comment")}
        </label>
        <textarea
          id={`${id}-comment`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          maxLength={2000}
          aria-describedby={`${id}-hint`}
          className="border-input bg-background rounded-md border p-3"
        />
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {t("submit.commentHint")}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onBack} disabled={pending}>
          {t("submit.back")}
        </Button>
        <Button onClick={() => void submit()} disabled={pending}>
          {t("submit.submit")}
        </Button>
      </div>
    </div>
  );
}
