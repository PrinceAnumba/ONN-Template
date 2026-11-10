"use client";

import type { FeedbackAdminItem } from "@onn/api-client/types";
import { BulkActionBar } from "@onn/ui/components/bulk-action-bar";
import { DataTable, type DataTableColumn } from "@onn/ui/components/data-table";
import { StatusPill } from "@onn/ui/components/status-pill";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onn/ui/components/ui/dialog";
import { useRestoreFocus } from "@onn/ui/lib/use-restore-focus";
import { LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { AREA, FIELD } from "@/components/forms/form-errors";
import { bff } from "@/lib/bff";
import { formatDate, formatTime } from "@/lib/format";
import { FEEDBACK_STATUSES, FEEDBACK_TONE } from "@/lib/governance";

type Status = FeedbackAdminItem["status"];

/**
 * Feedback inbox (brief §7): select messages to set their status in bulk, or open one to read it
 * in full, set its status and keep an internal note.
 */
export function FeedbackInbox({
  items,
  portal,
  emptyLabel,
}: {
  items: FeedbackAdminItem[];
  /** Portal origin, for links to the page a message was sent from. */
  portal: string;
  emptyLabel: string;
}) {
  const t = useTranslations("Admin.feedback");
  const forms = useTranslations("Admin.forms");
  const common = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ status: Status; note: string }>({ status: "new", note: "" });
  const [busy, setBusy] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRestoreFocus(openId !== null);
  const open = items.find((item) => item.id === openId);
  const when = (date: string) =>
    forms("dateTime", {
      date: formatDate(date, locale, "medium"),
      time: formatTime(date, locale),
    });
  const rating = (item: FeedbackAdminItem) =>
    item.rating !== undefined
      ? t("rating", { rating: item.rating })
      : item.useful !== undefined
        ? t(item.useful ? "useful" : "notUseful")
        : t("noRating");

  const columns = useMemo<DataTableColumn<FeedbackAdminItem>[]>(
    () => [
      {
        id: "date",
        header: t("column.date"),
        value: (row) => formatDate(row.date, locale, "medium"),
        width: 130,
        sortable: false,
      },
      {
        id: "rating",
        header: t("column.rating"),
        value: (row) =>
          row.rating !== undefined
            ? t("rating", { rating: row.rating })
            : row.useful !== undefined
              ? t(row.useful ? "useful" : "notUseful")
              : t("noRating"),
        width: 110,
        sortable: false,
      },
      {
        id: "page",
        header: t("column.page"),
        value: (row) => row.page,
        width: 170,
        sortable: false,
      },
      {
        id: "message",
        header: t("column.message"),
        value: (row) => row.message ?? "",
        cell: (row) => <span className="line-clamp-2">{row.message || t("noMessage")}</span>,
        minWidth: 280,
        sortable: false,
      },
      {
        id: "status",
        header: t("column.status"),
        value: (row) => t(`status.${row.status}`),
        cell: (row) => (
          <StatusPill tone={FEEDBACK_TONE[row.status]} label={t(`status.${row.status}`)} />
        ),
        width: 130,
        sortable: false,
      },
      {
        id: "open",
        header: t("column.open"),
        value: (row) => row.id,
        cell: (row) => (
          <Button
            variant="secondary"
            size="sm"
            aria-label={t("openLabel", { id: row.id })}
            onClick={() => {
              setDraft({ status: row.status, note: row.note ?? "" });
              setOpenId(row.id);
            }}
          >
            {t("open")}
          </Button>
        ),
        width: 110,
        sortable: false,
      },
    ],
    [t, locale],
  );

  const bulk = async (status: Status) => {
    setBusy(true);
    try {
      const result = await bff<{ done: string[]; failed: { id: string }[] }>("/feedback/bulk", {
        method: "POST",
        body: { ids: [...selected], status },
      });
      if (result.done.length) {
        showToast(t("bulk.done", { count: result.done.length, status: t(`status.${status}`) }));
      }
      if (result.failed.length) {
        showToast(t("bulk.failed", { count: result.failed.length }), "error");
      }
      setSelected(new Set(result.failed.map((item) => item.id)));
      // The bar hides when nothing stays selected, taking focus with it.
      if (!result.failed.length) tableRef.current?.focus();
      router.refresh();
    } catch {
      showToast(forms("saveFailed"), "error");
    } finally {
      setBusy(false);
    }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!open) return;
    setBusy(true);
    try {
      await bff(`/feedback/${open.id}`, { method: "PATCH", body: draft });
      showToast(t("saved"));
      setOpenId(null);
      router.refresh();
    } catch {
      showToast(forms("saveFailed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={tableRef} tabIndex={-1} className="outline-none">
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={items}
        rowId={(row) => row.id}
        emptyLabel={emptyLabel}
        sortLabel={(header) => header}
        maxHeight={720}
        selection={{
          selected,
          onChange: setSelected,
          rowLabel: (row) => t("selectRow", { id: row.id }),
          allLabel: t("selectAll"),
        }}
      />
      <BulkActionBar
        count={selected.size}
        countLabel={t("bulk.count", { count: selected.size })}
        label={t("bulk.label")}
        clearLabel={t("bulk.clear")}
        onClear={() => setSelected(new Set())}
      >
        {FEEDBACK_STATUSES.map((status) => (
          <Button key={status} variant="secondary" disabled={busy} onClick={() => bulk(status)}>
            {t(`status.${status}`)}
          </Button>
        ))}
      </BulkActionBar>

      <Dialog open={openId !== null} onOpenChange={(next) => !next && setOpenId(null)}>
        <DialogContent closeLabel={common("close")} onCloseAutoFocus={restoreFocus}>
          {open && (
            <form onSubmit={save} className="flex min-w-0 flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{t("detailTitle", { id: open.id })}</DialogTitle>
                <DialogDescription>
                  {t("detailMeta", { date: when(open.date), rating: rating(open) })}
                </DialogDescription>
              </DialogHeader>
              <p className="whitespace-pre-wrap">{open.message || t("noMessage")}</p>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("column.page")}</dt>
                  <dd>
                    <a
                      href={`${portal}${open.page}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center break-all underline"
                    >
                      {open.page}
                      <span className="sr-only"> {forms("newWindow")}</span>
                    </a>
                  </dd>
                </div>
                {open.email && (
                  <div>
                    <dt className="text-muted-foreground">{t("email")}</dt>
                    <dd>
                      <a
                        href={`mailto:${open.email}`}
                        className="inline-flex min-h-11 items-center break-all underline"
                      >
                        {open.email}
                      </a>
                    </dd>
                  </div>
                )}
                {open.errorId && (
                  <div>
                    <dt className="text-muted-foreground">{t("errorId")}</dt>
                    <dd className="break-all">{open.errorId}</dd>
                  </div>
                )}
              </dl>
              <div>
                <label htmlFor={`${id}-status`} className="mb-1 block font-semibold">
                  {t("column.status")}
                </label>
                <select
                  id={`${id}-status`}
                  className={FIELD}
                  value={draft.status}
                  onChange={(event) => setDraft({ ...draft, status: event.target.value as Status })}
                >
                  {FEEDBACK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`status.${status}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-note`} className="mb-1 block font-semibold">
                  {t("note")} <span className="font-normal">{forms("optional")}</span>
                </label>
                <textarea
                  id={`${id}-note`}
                  className={AREA}
                  rows={3}
                  maxLength={1000}
                  value={draft.note}
                  aria-describedby={`${id}-note-hint`}
                  onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                />
                <p id={`${id}-note-hint`} className="text-muted-foreground mt-1 text-sm">
                  {t("noteHint")}
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpenId(null)}>
                  {forms("cancel")}
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />}
                  {forms("save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
