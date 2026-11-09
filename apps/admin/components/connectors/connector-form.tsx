"use client";

import type {
  Connector,
  ConnectorDryRun,
  ConnectorInput,
  ConnectorMapping,
  ConnectorRun,
  ConnectorTestResult,
  ImportField,
} from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { EMPTY_VALUE } from "@onn/ui/format";
import { cn } from "@onn/ui/lib/utils";
import { CircleAlertIcon, CircleCheckIcon, LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { bff, BffError } from "@/lib/bff";
import { CONNECTOR_AUTHS, CONNECTOR_TYPES, SCHEDULE_EXAMPLES } from "@/lib/connectors";
import { cronText, nextRun, type CronT } from "@/lib/cron-text";
import { formatDate, formatNumber, formatTime } from "@/lib/format";

const FIELD = "border-input bg-background h-11 w-full rounded-md border px-3";
const REQUIRED: ImportField[] = ["indicator", "area", "period", "value"];
type FieldError = { path: string; message: string };

interface ConnectorFormProps {
  /** The saved connector; absent on the "new" page. */
  initial?: Connector;
  orgs: { code: string; name: string }[];
  defaultOrg: string;
  canManage: boolean;
}

/** Settings, field mapping, "Test connection", "Dry run" and "Run now" (brief §7 Connectors). */
export function ConnectorForm({ initial, orgs, defaultOrg, canManage }: ConnectorFormProps) {
  const t = useTranslations("Admin.connectors");
  const cron = useTranslations("Admin.connectors.cron") as unknown as CronT;
  const fields = useTranslations("Admin.imports.field");
  const dims = useTranslations("Admin.indicators.dimension");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const saved = useMemo<ConnectorInput>(
    () => ({
      name: initial?.name ?? "",
      org: initial?.org ?? defaultOrg,
      type: initial?.type ?? "sdmx",
      endpoint: initial?.endpoint ?? "",
      auth: initial?.auth ?? "none",
      schedule: initial?.schedule ?? "0 6 * * 1",
      enabled: initial?.enabled ?? true,
      mapping: initial?.mapping ?? [],
    }),
    [initial, defaultOrg],
  );
  const [form, setForm] = useState<ConnectorInput>(saved);
  const [targets, setTargets] = useState<ImportField[]>(initial?.targets ?? []);
  const [auto, setAuto] = useState<Set<string>>(new Set());
  const [test, setTest] = useState<ConnectorTestResult | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState<"test" | "save" | "dry" | "run" | null>(null);
  const [dry, setDry] = useState<ConnectorDryRun | null>(null);
  const [dryError, setDryError] = useState<string | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  // Saved props change after router.refresh(); start again from them.
  useEffect(() => setForm(saved), [saved]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof ConnectorInput>(key: K, value: ConnectorInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const errorFor = (path: string) => errors.find((error) => error.path === path);
  const fieldId = (path: string) => `${id}-${path.replace(/\W/g, "-")}`;
  const describedBy = (path: string, hint?: string) =>
    [hint, errorFor(path) ? `${fieldId(path)}-error` : undefined].filter(Boolean).join(" ") ||
    undefined;

  const targetLabel = (target: ImportField) =>
    target.startsWith("dim:")
      ? fields("dim", { name: dims(target.slice(4)) })
      : fields(target as Exclude<ImportField, `dim:${string}`>);
  const errorText = (error: FieldError) => {
    if (error.path.startsWith("mapping.")) {
      const key = error.path.slice(8);
      if (REQUIRED.includes(key as ImportField)) {
        return t("error.mapField", { field: fields(key as Exclude<ImportField, `dim:${string}`>) });
      }
      const source = form.mapping[Number(key)]?.source ?? key;
      return t(`error.${error.message === "duplicate" ? "duplicate" : "unknown"}`, { source });
    }
    return t(
      `error.${["required", "scheme", "cron", "length"].includes(error.message) ? error.message : "required"}`,
    );
  };
  /** Mapping errors point at the mapping table; the others at their field. */
  const anchorOf = (path: string) =>
    path.startsWith("mapping.") ? `${id}-mapping` : fieldId(path);

  const runTest = async () => {
    setBusy("test");
    setTest(null);
    try {
      const result = await bff<ConnectorTestResult>("/connectors/test", {
        method: "POST",
        body: { type: form.type, endpoint: form.endpoint, auth: form.auth, org: form.org },
      });
      setTest(result);
      if (result.ok) {
        setTargets(result.targets ?? targets);
        // Keep choices already made for fields that still exist; suggest the rest.
        const kept = new Map(form.mapping.map((item) => [item.source, item.target]));
        const suggested = new Map(
          (result.suggested ?? []).map((item) => [item.source, item.target]),
        );
        const mapping: ConnectorMapping[] = result.fields.map((source) => ({
          source,
          target: kept.get(source) ?? suggested.get(source) ?? "ignore",
        }));
        setAuto(
          new Set(
            result.fields.filter(
              (source) => !kept.has(source) && (suggested.get(source) ?? "ignore") !== "ignore",
            ),
          ),
        );
        set("mapping", mapping);
      }
    } catch {
      showToast(t("testError"), "error");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    setErrors([]);
    try {
      const result = await bff<Connector>(
        initial ? `/connectors/${encodeURIComponent(initial.id)}` : "/connectors",
        { method: initial ? "PUT" : "POST", body: form },
      );
      if (initial) {
        showToast(t("saved"));
        router.refresh();
      } else {
        showToast(t("created"));
        router.push(`/connectors/${encodeURIComponent(result.id)}`);
      }
    } catch (error) {
      if (error instanceof BffError && error.status === 422) {
        setErrors(error.errors.length ? error.errors : [{ path: "name", message: "required" }]);
        requestAnimationFrame(() => summary.current?.focus());
      } else {
        showToast(t("saveFailed"), "error");
      }
    } finally {
      setBusy(null);
    }
  };

  const dryRun = async () => {
    if (!initial) return;
    setBusy("dry");
    setDryError(null);
    try {
      setDry(
        await bff<ConnectorDryRun>(`/connectors/${encodeURIComponent(initial.id)}/dry-run`, {
          method: "POST",
          body: { mapping: form.mapping },
        }),
      );
    } catch (error) {
      setDry(null);
      const type = error instanceof BffError ? error.type : "other";
      setDryError(t(`dryRunFailed.${["mapping", "unreachable"].includes(type) ? type : "other"}`));
    } finally {
      setBusy(null);
    }
  };

  const runNow = async () => {
    if (!initial || dirty) return;
    setBusy("run");
    try {
      const run = await bff<ConnectorRun>(`/connectors/${encodeURIComponent(initial.id)}/run`, {
        method: "POST",
      });
      if (run.status === "failed") {
        showToast(t("runFailed", { error: run.error ?? "" }), "error");
      } else if (run.submission) {
        const submission = run.submission;
        showToast(t("runDone", { count: run.rows, id: submission }), "info", {
          label: t("openSubmission"),
          onClick: () => router.push(`/submissions/${encodeURIComponent(submission)}`),
        });
      } else {
        showToast(t("runNoRows"));
      }
      router.refresh();
    } catch {
      showToast(t("runError"), "error");
    } finally {
      setBusy(null);
    }
  };

  const schedule = cronText(form.schedule, cron, locale);
  const next = schedule ? nextRun(form.schedule) : null;
  const sources = form.mapping.map((item) => item.source);
  const readOnly = !canManage;
  const spinner = <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />;

  return (
    <div className="mt-6 flex flex-col gap-8">
      {errors.length > 0 && (
        <div
          ref={summary}
          tabIndex={-1}
          role="alert"
          aria-labelledby={`${id}-summary`}
          className="border-destructive max-w-3xl rounded-lg border-2 p-4"
        >
          <h2 id={`${id}-summary`} className="text-h4">
            {t("error.title", { count: errors.length })}
          </h2>
          <ul className="mt-2 list-disc ps-5">
            {errors.map((error) => (
              <li key={`${error.path}-${error.message}`}>
                <a href={`#${anchorOf(error.path)}`} className="underline">
                  {errorText(error)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {readOnly && <p className="bg-surface-2 max-w-3xl rounded-md p-3">{t("readOnly")}</p>}

      <section aria-labelledby={`${id}-settings`} className="rounded-lg border p-4 md:p-6">
        <h2 id={`${id}-settings`} className="text-h3">
          {t("section.settings")}
        </h2>
        <fieldset disabled={readOnly} className="mt-4 grid gap-4 md:grid-cols-2">
          <legend className="sr-only">{t("section.settings")}</legend>
          <Field
            label={t("field.name")}
            id={fieldId("name")}
            error={errorFor("name") && errorText(errorFor("name")!)}
          >
            <input
              id={fieldId("name")}
              className={FIELD}
              value={form.name}
              maxLength={80}
              aria-invalid={Boolean(errorFor("name"))}
              aria-describedby={describedBy("name")}
              onChange={(event) => set("name", event.target.value)}
            />
          </Field>
          <Field
            label={t("field.org")}
            id={fieldId("org")}
            error={errorFor("org") && errorText(errorFor("org")!)}
          >
            <select
              id={fieldId("org")}
              className={FIELD}
              value={form.org}
              aria-describedby={describedBy("org")}
              onChange={(event) => set("org", event.target.value)}
            >
              {orgs.map((org) => (
                <option key={org.code} value={org.code}>
                  {org.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("field.type")} id={fieldId("type")}>
            <select
              id={fieldId("type")}
              className={FIELD}
              value={form.type}
              onChange={(event) => {
                set("type", event.target.value as ConnectorInput["type"]);
                setTest(null);
              }}
            >
              {CONNECTOR_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`type.${type}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("field.auth")} id={fieldId("auth")}>
            <select
              id={fieldId("auth")}
              className={FIELD}
              value={form.auth}
              aria-describedby={form.auth === "none" ? undefined : `${fieldId("auth")}-hint`}
              onChange={(event) => set("auth", event.target.value as ConnectorInput["auth"])}
            >
              {CONNECTOR_AUTHS.map((auth) => (
                <option key={auth} value={auth}>
                  {t(`auth.${auth}`)}
                </option>
              ))}
            </select>
            {form.auth !== "none" && (
              <p id={`${fieldId("auth")}-hint`} className="text-muted-foreground mt-1 text-sm">
                {t("secretNote")}
              </p>
            )}
          </Field>
          <div className="md:col-span-2">
            <Field
              label={t("field.endpoint")}
              id={fieldId("endpoint")}
              error={errorFor("endpoint") && errorText(errorFor("endpoint")!)}
            >
              <input
                id={fieldId("endpoint")}
                className={FIELD}
                value={form.endpoint}
                type="url"
                inputMode="url"
                spellCheck={false}
                aria-invalid={Boolean(errorFor("endpoint"))}
                aria-describedby={describedBy("endpoint", `${fieldId("endpoint")}-hint`)}
                onChange={(event) => {
                  set("endpoint", event.target.value);
                  setTest(null);
                }}
              />
              <p id={`${fieldId("endpoint")}-hint`} className="text-muted-foreground mt-1 text-sm">
                {t("endpointHint")}
              </p>
            </Field>
          </div>
          <Field
            label={t("field.schedule")}
            id={fieldId("schedule")}
            error={errorFor("schedule") && errorText(errorFor("schedule")!)}
          >
            <input
              id={fieldId("schedule")}
              className={cn(FIELD, "font-mono")}
              value={form.schedule}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={Boolean(errorFor("schedule")) || !schedule}
              aria-describedby={describedBy(
                "schedule",
                `${fieldId("schedule")}-text ${fieldId("schedule")}-hint`,
              )}
              onChange={(event) => set("schedule", event.target.value)}
            />
            <p
              id={`${fieldId("schedule")}-text`}
              className={cn("mt-1 text-sm font-semibold", !schedule && "text-destructive")}
              aria-live="polite"
            >
              {schedule ?? t("error.cron")}
              {next && (
                <span className="text-muted-foreground ms-1 font-normal">
                  {t("nextRun", {
                    date: formatDate(next.toISOString(), locale, "medium"),
                    time: formatTime(next, locale),
                  })}
                </span>
              )}
            </p>
            <p id={`${fieldId("schedule")}-hint`} className="text-muted-foreground mt-1 text-sm">
              {t("scheduleHint", { examples: SCHEDULE_EXAMPLES.join(", ") })}
            </p>
          </Field>
          <div className="flex items-center gap-3 self-center pt-6">
            <input
              id={fieldId("enabled")}
              type="checkbox"
              className="size-5"
              checked={form.enabled}
              onChange={(event) => set("enabled", event.target.checked)}
            />
            <label htmlFor={fieldId("enabled")}>{t("field.enabled")}</label>
          </div>
        </fieldset>
        {canManage && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={runTest}
              disabled={busy !== null || !form.endpoint}
            >
              {busy === "test" && spinner}
              {t(busy === "test" ? "testing" : "test")}
            </Button>
            <p role="status" className="text-sm">
              {test?.ok && (
                <span className="inline-flex items-center gap-2">
                  <CircleCheckIcon aria-hidden="true" className="text-positive size-4" />
                  {t("testOk", { ms: test.latencyMs, count: test.fields.length })}
                </span>
              )}
              {test && !test.ok && (
                <span className="text-destructive inline-flex items-center gap-2">
                  <CircleAlertIcon aria-hidden="true" className="size-4" />
                  {t(`testFailed.${test.error ?? "unreachable"}`, { detail: test.detail ?? "" })}
                </span>
              )}
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby={`${id}-mapping`} className="rounded-lg border p-4 md:p-6">
        <h2 id={`${id}-mapping`} tabIndex={-1} className="text-h3">
          {t("section.mapping")}
        </h2>
        <p className="text-muted-foreground mt-1">{t("mappingIntro")}</p>
        {form.mapping.length === 0 ? (
          <p className="mt-4">{t(canManage ? "mappingEmpty" : "mappingNone")}</p>
        ) : (
          <div className="relative mt-4 overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t("section.mapping")}</caption>
              <thead className="bg-surface-2">
                <tr>
                  <th scope="col" className="p-3 text-start font-semibold">
                    {t("mappingColumn.source")}
                  </th>
                  <th scope="col" className="p-3 text-start font-semibold">
                    {t("mappingColumn.target")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {form.mapping.map((item, index) => {
                  const error = errorFor(`mapping.${index}`);
                  return (
                    <tr key={item.source} className="border-t">
                      <th scope="row" className="p-3 text-start font-mono font-normal">
                        {item.source}
                      </th>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            className={cn(FIELD, "max-w-xs")}
                            value={item.target}
                            disabled={readOnly}
                            aria-label={t("mappingLabel", { source: item.source })}
                            aria-invalid={Boolean(error)}
                            aria-describedby={
                              error ? `${fieldId(`mapping.${index}`)}-error` : undefined
                            }
                            onChange={(event) => {
                              const target = event.target.value as ImportField;
                              setAuto((current) => {
                                const next = new Set(current);
                                next.delete(item.source);
                                return next;
                              });
                              set(
                                "mapping",
                                form.mapping.map((entry, position) =>
                                  position === index ? { ...entry, target } : entry,
                                ),
                              );
                            }}
                          >
                            {(targets.length ? targets : [item.target]).map((target) => (
                              <option key={target} value={target}>
                                {targetLabel(target)}
                              </option>
                            ))}
                          </select>
                          {auto.has(item.source) && (
                            <span className="text-muted-foreground text-xs">{t("auto")}</span>
                          )}
                        </div>
                        {error && (
                          <p
                            id={`${fieldId(`mapping.${index}`)}-error`}
                            className="text-destructive mt-1 text-sm"
                          >
                            {errorText(error)}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {REQUIRED.some((field) => errorFor(`mapping.${field}`)) && (
          <ul className="text-destructive mt-3 list-disc ps-5 text-sm">
            {REQUIRED.filter((field) => errorFor(`mapping.${field}`)).map((field) => (
              <li key={field}>{errorText(errorFor(`mapping.${field}`)!)}</li>
            ))}
          </ul>
        )}
        {sources.length > 0 && test === null && initial && canManage && (
          <p className="text-muted-foreground mt-3 text-sm">{t("mappingRetest")}</p>
        )}
      </section>

      {canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={busy !== null}>
            {busy === "save" && spinner}
            {t(initial ? "save" : "create")}
          </Button>
          {dirty && <p className="text-muted-foreground text-sm">{t("unsaved")}</p>}
        </div>
      )}

      {initial && (
        <section aria-labelledby={`${id}-dry`} className="rounded-lg border p-4 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id={`${id}-dry`} className="text-h3">
                {t("section.dryRun")}
              </h2>
              <p className="text-muted-foreground mt-1 max-w-2xl">{t("dryRunIntro")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={dryRun} disabled={busy !== null}>
                {busy === "dry" && spinner}
                {t("dryRun")}
              </Button>
              {canManage && (
                <div className="flex flex-col items-start gap-1">
                  <Button
                    onClick={runNow}
                    disabled={busy !== null}
                    aria-disabled={dirty || undefined}
                    aria-describedby={dirty ? `${id}-run-why` : undefined}
                  >
                    {busy === "run" && spinner}
                    {t("runNow")}
                  </Button>
                  {dirty && (
                    <p id={`${id}-run-why`} className="text-muted-foreground text-xs">
                      {t("runNeedsSave")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div aria-live="polite">
            {dryError && (
              <p role="alert" className="text-destructive mt-4">
                {dryError}
              </p>
            )}
            {dry && (
              <>
                <p className="mt-4">
                  {t("dryRunResult", {
                    total: dry.total,
                    shown: dry.rows.length,
                    issues: dry.issues,
                  })}
                </p>
                <div
                  className="relative mt-3 max-h-96 overflow-auto rounded-md border"
                  // Scrollable regions need to be focusable for keyboard users.
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                  tabIndex={0}
                  role="region"
                  aria-label={t("dryRunRows")}
                >
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">{t("section.dryRun")}</caption>
                    <thead className="bg-surface-2 sticky top-0">
                      <tr>
                        {(
                          ["indicator", "area", "period", "breakdown", "value", "flag"] as const
                        ).map((key) => (
                          <th
                            key={key}
                            scope="col"
                            className="p-2 text-start font-semibold whitespace-nowrap"
                          >
                            {t(`dryRunColumn.${key}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dry.rows.map((row, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2 font-mono">{row.indicator}</td>
                          <td className="p-2 font-mono">{row.area}</td>
                          <td className="p-2">{row.period}</td>
                          <td className="p-2">
                            {Object.keys(row.dims).length
                              ? Object.entries(row.dims)
                                  .map(([key, value]) => `${dims(key)}: ${value}`)
                                  .join(", ")
                              : EMPTY_VALUE}
                          </td>
                          <td className="p-2 text-end tabular-nums">
                            {row.value === null ? EMPTY_VALUE : formatNumber(row.value, locale)}
                          </td>
                          <td className="p-2">{row.flag ?? EMPTY_VALUE}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string | false;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-destructive mt-1 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
