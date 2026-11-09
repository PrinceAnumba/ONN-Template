"use client";

import type { SubmissionAction, SubmissionSummary } from "@onn/api-client/types";
import { BulkActionBar } from "@onn/ui/components/bulk-action-bar";
import { DataTable, type DataTableColumn } from "@onn/ui/components/data-table";
import { StatusPill } from "@onn/ui/components/status-pill";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { bulkTransition } from "@/app/(app)/submissions/actions";
import { formatDate } from "@/lib/format";
import { STATUS_TONE } from "@/lib/submissions";
import { ReturnDialog } from "./return-dialog";

/** Submissions list with selection and the bulk-action bar (brief §7 list pattern). */
export function SubmissionsTable({
  items,
  actions,
}: {
  items: SubmissionSummary[];
  /** Bulk actions the role may take. */
  actions: SubmissionAction[];
}) {
  const t = useTranslations("Admin.submissions");
  const status = useTranslations("Admin.status.submission");
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [returning, setReturning] = useState(false);
  const [pending, startTransition] = useTransition();
  const tableRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<DataTableColumn<SubmissionSummary>[]>(
    () => [
      {
        id: "id",
        header: t("column.id"),
        value: (row) => row.id,
        cell: (row) => (
          <Link href={`/submissions/${row.id}`} className="font-semibold underline">
            {row.id}
          </Link>
        ),
        width: 120,
        sortable: false,
      },
      {
        id: "org",
        header: t("column.org"),
        value: (row) => row.orgName,
        width: 200,
        sortable: false,
      },
      {
        id: "indicators",
        header: t("column.indicators"),
        value: (row) => row.indicators.join(", "),
        width: 220,
        sortable: false,
      },
      {
        id: "period",
        header: t("column.period"),
        value: (row) => row.period,
        width: 100,
        sortable: false,
      },
      {
        id: "channel",
        header: t("column.channel"),
        value: (row) => t(`channel.${row.channel}`),
        width: 120,
        sortable: false,
      },
      {
        id: "status",
        header: t("column.status"),
        value: (row) => row.status,
        cell: (row) => <StatusPill tone={STATUS_TONE[row.status]} label={status(row.status)} />,
        width: 130,
        sortable: false,
      },
      {
        id: "by",
        header: t("column.submittedBy"),
        value: (row) => row.submittedBy.name,
        width: 160,
        sortable: false,
      },
      {
        id: "updated",
        header: t("column.updated"),
        value: (row) => formatDate(row.updated, locale, "medium"),
        width: 130,
        sortable: false,
      },
    ],
    [t, status, locale],
  );

  const run = (action: SubmissionAction, comment?: string) =>
    startTransition(async () => {
      const ids = [...selected];
      const result = await bulkTransition(ids, action, comment);
      setReturning(false);
      if ("error" in result) {
        showToast(t("bulk.failed"), "error");
        return;
      }
      if (result.done.length)
        showToast(t(`bulk.done.${action}`, { count: result.done.length }), "info");
      if (result.failed.length) {
        showToast(
          t("bulk.someFailed", {
            count: result.failed.length,
            ids: result.failed.map((item) => item.id).join(", "),
          }),
          "error",
        );
      }
      setSelected(new Set(result.failed.map((item) => item.id)));
      // The bar hides when nothing stays selected, taking focus with it; move it to the table.
      if (!result.failed.length) tableRef.current?.focus();
      router.refresh();
    });

  return (
    <div ref={tableRef} tabIndex={-1} className="outline-none">
      <DataTable
        caption={t("caption")}
        columns={columns}
        rows={items}
        rowId={(row) => row.id}
        emptyLabel={t("empty")}
        sortLabel={(header) => header}
        maxHeight={720}
        selection={
          actions.length
            ? {
                selected,
                onChange: setSelected,
                rowLabel: (row) => t("selectRow", { id: row.id }),
                allLabel: t("selectAll"),
              }
            : undefined
        }
      />
      {actions.length > 0 && (
        <BulkActionBar
          count={selected.size}
          countLabel={t("bulk.count", { count: selected.size })}
          label={t("bulk.label")}
          clearLabel={t("bulk.clear")}
          onClear={() => setSelected(new Set())}
        >
          {actions.map((action) => (
            <Button
              key={action}
              variant="secondary"
              disabled={pending}
              onClick={() => (action === "return" ? setReturning(true) : run(action))}
            >
              {t(`action.${action}`)}
            </Button>
          ))}
        </BulkActionBar>
      )}
      <ReturnDialog
        open={returning}
        onOpenChange={setReturning}
        count={selected.size}
        pending={pending}
        onConfirm={(comment) => run("return", comment)}
      />
    </div>
  );
}
