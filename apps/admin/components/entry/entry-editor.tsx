"use client";

import { parseNumber, valueIssues } from "@onn/api-client/quality";
import type { EntryCell, EntrySaveResult, EntrySheet } from "@onn/api-client/types";
import { EntryGrid, type EntryGridIssue } from "@onn/ui/components/entry-grid";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { CloudOffIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { transitionSubmission } from "@/app/(app)/submissions/actions";
import { bff, BffError } from "@/lib/bff";
import { deleteDraft, draftKey, readDraft, writeDraft } from "@/lib/drafts";
import { formatNumber, formatTime } from "@/lib/format";

/** Brief §7: autosave every 10 s. */
const AUTOSAVE_MS = 10_000;

type SaveState = "idle" | "pending" | "saving" | "saved" | "offline" | "error";

const cellKey = (row: string, period: string) => `${row}|${period}`;

/** The entry grid with autosave, offline drafts on this device and inline validation. */
export function EntryEditor({ sheet }: { sheet: EntrySheet }) {
  const t = useTranslations("Admin.entry");
  const rule = useTranslations("Admin.imports.rule");
  const dims = useTranslations("Indicator.dims");
  const statusLabel = useTranslations("Admin.status.submission");
  const dimValues = useTranslations("Indicator.dimValues");
  const locale = useLocale();
  const router = useRouter();
  const hintId = useId();
  const target = sheet.periods.at(-1)!;
  const storageKey = draftKey(sheet.org, sheet.indicator.code, target);
  const readOnly = Boolean(sheet.locked);

  const format = useCallback(
    (value: number | null | undefined) =>
      value === null || value === undefined
        ? ""
        : formatNumber(value, locale, { useGrouping: false, maximumFractionDigits: 4 }),
    [locale],
  );
  const rowsByKey = useMemo(() => new Map(sheet.rows.map((row) => [row.key, row])), [sheet.rows]);
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      sheet.rows.flatMap((row) =>
        sheet.periods.map((period) => [cellKey(row.key, period), format(row.values[period])]),
      ),
    ),
  );
  /** Cells changed since the last successful save, with a counter so a save that raced an edit
   * doesn't clear it. */
  const pending = useRef(new Map<string, number>());
  const [pendingCount, setPendingCount] = useState(0);
  const [state, setState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | undefined>(sheet.draft?.updated);
  const [submission, setSubmission] = useState(sheet.draft?.submission);
  const [online, setOnline] = useState(true);
  const [restored, setRestored] = useState(0);
  const [submitting, startSubmit] = useTransition();
  const textRef = useRef(text);
  // Kept in step by onChange; restored drafts also go through setText, so sync on render too.
  textRef.current = text;

  const toCell = useCallback(
    (key: string): EntryCell | null => {
      const [rowKey, period] = [
        key.slice(0, key.lastIndexOf("|")),
        key.slice(key.lastIndexOf("|") + 1),
      ];
      const row = rowsByKey.get(rowKey);
      if (!row) return null;
      const value = parseNumber(textRef.current[key] ?? "");
      if (Number.isNaN(value)) return null;
      return { area: row.area, dims: row.dims, period, value };
    },
    [rowsByKey],
  );

  const remember = useCallback(() => {
    const cells = [...pending.current.keys()]
      .map((key) => ({ key, cell: toCell(key) }))
      .filter((item): item is { key: string; cell: EntryCell } => item.cell !== null);
    if (pending.current.size === 0) void deleteDraft(storageKey);
    else
      void writeDraft({
        key: storageKey,
        cells: cells.map((item) => item.cell),
        updated: new Date().toISOString(),
      });
  }, [storageKey, toCell]);

  const save = useCallback(async () => {
    if (readOnly || pending.current.size === 0) return true;
    const snapshot = new Map(pending.current);
    const cells = [...snapshot.keys()]
      .map(toCell)
      .filter((cell): cell is EntryCell => cell !== null);
    if (!cells.length) return false;
    setState("saving");
    try {
      const result = await bff<EntrySaveResult>(
        `/entry/${encodeURIComponent(sheet.indicator.code)}?period=${encodeURIComponent(target)}`,
        { method: "PUT", body: { cells } },
      );
      for (const [key, version] of snapshot) {
        // Text that isn't a number stays pending: it wasn't sent.
        if (pending.current.get(key) === version && toCell(key)) pending.current.delete(key);
      }
      setPendingCount(pending.current.size);
      setSubmission(result.submission);
      setSavedAt(result.saved);
      setState(pending.current.size ? "pending" : "saved");
      remember();
      return true;
    } catch (error) {
      if (error instanceof BffError && error.type === "state") {
        showToast(t("locked"), "error");
        router.refresh();
      } else setState(error instanceof BffError && error.status === 0 ? "offline" : "error");
      return false;
    }
  }, [readOnly, remember, router, sheet.indicator.code, t, target, toCell]);

  // Restore cells kept on this device that are newer than the server's draft.
  useEffect(() => {
    if (readOnly) return;
    void readDraft(storageKey).then((local) => {
      if (!local?.cells.length) return;
      if (sheet.draft && local.updated <= sheet.draft.updated) {
        void deleteDraft(storageKey);
        return;
      }
      const next: Record<string, string> = {};
      for (const cell of local.cells) {
        const row = sheet.rows.find(
          (item) =>
            item.area === cell.area && JSON.stringify(item.dims) === JSON.stringify(cell.dims),
        );
        if (!row || !sheet.periods.includes(cell.period)) continue;
        const key = cellKey(row.key, cell.period);
        next[key] = format(cell.value);
        pending.current.set(key, (pending.current.get(key) ?? 0) + 1);
      }
      setText((current) => ({ ...current, ...next }));
      setPendingCount(pending.current.size);
      setRestored(Object.keys(next).length);
      setState("pending");
    });
    // Runs once per sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave, online and offline handling.
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => {
      setOnline(true);
      void save();
    };
    const goOffline = () => {
      setOnline(false);
      setState((current) => (pending.current.size ? "offline" : current));
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = setInterval(() => {
      if (navigator.onLine) void save();
    }, AUTOSAVE_MS);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(timer);
    };
  }, [save]);

  const valueAt = (rowKey: string, index: number) => {
    const period = sheet.periods[index];
    if (period === undefined) return rowsByKey.get(rowKey)?.before ?? null;
    const parsed = parseNumber(text[cellKey(rowKey, period)] ?? "");
    return Number.isNaN(parsed) ? null : parsed;
  };

  const issueOf = (rowKey: string, period: string): EntryGridIssue | undefined => {
    const key = cellKey(rowKey, period);
    const row = rowsByKey.get(rowKey)!;
    const raw = text[key] ?? "";
    const parsed = parseNumber(raw);
    if (Number.isNaN(parsed))
      return { level: "error", label: t("issue", { rule: rule("number") }) };
    if (parsed === null) {
      // An empty cell is only a problem when it clears a published value.
      return pending.current.has(key) && row.published[period] !== null
        ? { level: "error", label: t("issue", { rule: rule("missing") }) }
        : undefined;
    }
    const index = sheet.periods.indexOf(period);
    const base = row.published[period] ?? valueAt(rowKey, index - 1);
    const found = valueIssues(parsed, sheet.indicator.unit, base);
    const worst = found.find((item) => item.level === "error") ?? found[0];
    return worst
      ? { level: worst.level, label: t("issue", { rule: rule(worst.rule) }) }
      : undefined;
  };

  const allIssues = sheet.rows.flatMap((row) =>
    sheet.periods.map((period) => issueOf(row.key, period)).filter(Boolean),
  ) as EntryGridIssue[];
  const errors = allIssues.filter((item) => item.level === "error").length;
  const warnings = allIssues.length - errors;

  const dimLabel = (row: EntrySheet["rows"][number]) =>
    Object.entries(row.dims)
      .map(([, value]) => (dimValues.has(value) ? dimValues(value) : value))
      .join(", ");
  const groupOf = (row: EntrySheet["rows"][number]) => {
    const keys = Object.keys(row.dims);
    return keys.length
      ? keys.map((key) => (dims.has(key) ? dims(key) : key)).join(", ")
      : undefined;
  };
  const rowLabel = (row: EntrySheet["rows"][number]) =>
    Object.keys(row.dims).length
      ? t("dimRow", { area: row.areaName, dim: dimLabel(row) })
      : row.areaName;

  const submit = () =>
    startSubmit(async () => {
      const saved = await save();
      if (!saved || !submission) {
        showToast(t("submitFailed"), "error");
        return;
      }
      const result = await transitionSubmission(submission, "submit");
      if (result.ok) {
        showToast(t("submitted", { id: submission }));
        router.push(`/submissions/${submission}`);
      } else {
        showToast(
          t.has(`refused.${result.reason}`) ? t(`refused.${result.reason}`) : t("submitFailed"),
          "error",
        );
      }
    });

  const blocked = errors > 0 || (!submission && pendingCount === 0) || !online;
  const statusText =
    state === "saving"
      ? t("saving")
      : state === "offline" || !online
        ? t("savedLocally")
        : state === "error"
          ? t("saveError")
          : pendingCount > 0
            ? t("unsaved")
            : savedAt
              ? t("savedAt", { time: formatTime(savedAt, locale) })
              : "";

  return (
    <div className="mt-6 grid gap-4">
      {sheet.locked ? (
        <div role="status" className="bg-surface-2 rounded-lg p-4">
          {t("lockedNotice", { status: statusLabel(sheet.locked) })}{" "}
          {sheet.draft && (
            <Link
              href={`/submissions/${sheet.draft.submission}`}
              className="font-semibold underline"
            >
              {t("openSubmission", { id: sheet.draft.submission })}
            </Link>
          )}
        </div>
      ) : (
        <>
          {!online && (
            <div
              role="status"
              className="border-at-risk flex items-center gap-2 rounded-lg border-2 p-3"
            >
              <CloudOffIcon aria-hidden className="size-5 shrink-0" />
              {t("offline")}
            </div>
          )}
          {restored > 0 && (
            <p role="status" className="bg-surface-2 rounded-lg p-3 text-sm">
              {t("restored", { count: restored })}
            </p>
          )}
          <p className="text-muted-foreground max-w-3xl text-sm">{t("help")}</p>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{t("issueSummary", { errors, warnings })}</p>
        <p role="status" aria-live="polite" className="text-muted-foreground min-h-5 text-sm">
          {statusText}
        </p>
      </div>

      <EntryGrid
        caption={t("caption", { name: sheet.indicator.name, unit: sheet.indicator.unit })}
        rowHeader={t("area")}
        columns={sheet.periods.map((period) => ({
          key: period,
          label: period,
          editable: !readOnly,
        }))}
        rows={sheet.rows.map((row) => ({
          key: row.key,
          label: Object.keys(row.dims).length ? dimLabel(row) : row.areaName,
          group: groupOf(row),
        }))}
        readOnly={readOnly}
        value={(row, period) => text[cellKey(row, period)] ?? ""}
        previous={(row, period) => {
          const value = valueAt(row, sheet.periods.indexOf(period) - 1);
          return value === null
            ? undefined
            : formatNumber(value, locale, { maximumFractionDigits: 2 });
        }}
        issue={issueOf}
        onChange={(changes) => {
          // Update the ref at once: the draft and the next save read it before React re-renders.
          const next = { ...textRef.current };
          for (const change of changes) next[cellKey(change.row, change.column)] = change.value;
          textRef.current = next;
          setText(next);
          for (const change of changes) {
            const key = cellKey(change.row, change.column);
            pending.current.set(key, (pending.current.get(key) ?? 0) + 1);
          }
          setPendingCount(pending.current.size);
          setState(navigator.onLine ? "pending" : "offline");
          remember();
        }}
        cellLabel={(rowKey, period) => {
          const row = rowsByKey.get(rowKey)!;
          const before = valueAt(rowKey, sheet.periods.indexOf(period) - 1);
          return t("cellLabel", {
            row: rowLabel(row),
            period,
            previous:
              before === null ? "" : formatNumber(before, locale, { maximumFractionDigits: 2 }),
            hasPrevious: before === null ? "no" : "yes",
          });
        }}
      />

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => void save()}
            disabled={pendingCount === 0 || !online || state === "saving"}
          >
            {t("saveNow")}
          </Button>
          <Button
            onClick={() => !blocked && submit()}
            disabled={submitting}
            aria-disabled={blocked || undefined}
            aria-describedby={blocked ? hintId : undefined}
            className={blocked ? "cursor-not-allowed opacity-45" : undefined}
          >
            {t("submit")}
          </Button>
          {blocked && (
            <p id={hintId} className="text-muted-foreground text-sm">
              {!online
                ? t("blockedOffline")
                : errors > 0
                  ? t("blockedErrors", { count: errors })
                  : t("blockedEmpty")}
            </p>
          )}
          {submission && (
            <Link href={`/submissions/${submission}`} className="ms-auto text-sm underline">
              {t("openSubmission", { id: submission })}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
