"use client";

import type { SubmissionRow } from "@onn/api-client/types";
import { DataTable, type DataTableColumn } from "@onn/ui/components/data-table";
import { EMPTY_VALUE } from "@onn/ui/format";
import { cn } from "@onn/ui/lib/utils";
import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { formatNumber } from "@/lib/format";

const number = (value: number | null, locale: string) =>
  value === null ? EMPTY_VALUE : formatNumber(value, locale, { maximumFractionDigits: 2 });

/**
 * The submitted values (brief §7 *Data* tab) with an error or warning icon in each cell that
 * breaks a rule, or the comparison with published values (*Diff* tab, changed cells highlighted).
 */
export function RowsTable({ rows, mode }: { rows: SubmissionRow[]; mode: "data" | "diff" }) {
  const t = useTranslations("Admin.submissions");
  const rule = useTranslations("Admin.quality.rule");
  const locale = useLocale();

  const columns = useMemo<DataTableColumn<SubmissionRow>[]>(() => {
    const base: DataTableColumn<SubmissionRow>[] = [
      {
        id: "indicator",
        header: t("column.indicator"),
        value: (row) => row.indicatorName,
        width: 240,
      },
      { id: "area", header: t("column.area"), value: (row) => row.areaName, width: 160 },
      { id: "period", header: t("column.period"), value: (row) => row.period, width: 100 },
    ];
    if (mode === "data") {
      return [
        ...base,
        {
          id: "value",
          header: t("column.value"),
          value: (row) => row.value,
          numeric: true,
          width: 180,
          cell: (row) => {
            const error = row.issues.find((issue) => issue.level === "error");
            const warning = row.issues.find((issue) => issue.level === "warning");
            const issue = error ?? warning;
            return (
              <span className="inline-flex items-center justify-end gap-1.5">
                {issue &&
                  (error ? (
                    <CircleAlertIcon aria-hidden className="text-negative size-4 shrink-0" />
                  ) : (
                    <TriangleAlertIcon aria-hidden className="text-at-risk size-4 shrink-0" />
                  ))}
                <span>
                  {number(row.value, locale)} {row.value !== null ? row.unit : ""}
                </span>
                {row.issues.map((item) => (
                  <span key={item.rule} className="sr-only">
                    {t(item.level === "error" ? "issueError" : "issueWarning", {
                      rule: rule(item.rule),
                    })}
                  </span>
                ))}
              </span>
            );
          },
        },
        {
          id: "status",
          header: t("column.flag"),
          value: (row) => row.status,
          width: 90,
          cell: (row) => t(`flag.${row.status}`),
        },
        {
          id: "issues",
          header: t("column.issues"),
          value: (row) => row.issues.map((item) => rule(item.rule)).join(", ") || null,
          width: 220,
        },
      ];
    }
    return [
      ...base,
      {
        id: "published",
        header: t("column.published"),
        value: (row) => row.published,
        numeric: true,
        width: 140,
        cell: (row) => (row.published === null ? t("diff.new") : number(row.published, locale)),
      },
      {
        id: "value",
        header: t("column.submitted"),
        value: (row) => row.value,
        numeric: true,
        width: 140,
        cell: (row) => {
          const changed = row.value !== row.published;
          return (
            <span className={cn(changed && "bg-at-risk/15 rounded-sm px-1.5 py-0.5 font-semibold")}>
              {number(row.value, locale)}
              {changed && <span className="sr-only ms-1">{t("diff.changed")}</span>}
            </span>
          );
        },
      },
      {
        id: "change",
        header: t("column.change"),
        value: (row) =>
          row.value !== null && row.published
            ? (row.value - row.published) / Math.abs(row.published)
            : null,
        numeric: true,
        width: 120,
        cell: (row) =>
          row.value !== null && row.published
            ? formatNumber((row.value - row.published) / Math.abs(row.published), locale, {
                style: "percent",
                maximumFractionDigits: 1,
                signDisplay: "exceptZero",
              })
            : EMPTY_VALUE,
      },
    ];
  }, [t, rule, locale, mode]);

  return (
    <DataTable
      caption={mode === "data" ? t("tab.data") : t("tab.diff")}
      columns={columns}
      rows={mode === "diff" ? rows.filter((row) => row.value !== row.published) : rows}
      rowId={(row) => row.id}
      emptyLabel={mode === "diff" ? t("diff.none") : t("noRows")}
      sortLabel={(header) => t("sortBy", { column: header })}
      legend={
        mode === "data" ? (
          <span className="inline-flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-1">
              <CircleAlertIcon aria-hidden className="text-negative size-4" />
              {t("legend.error")}
            </span>
            <span className="inline-flex items-center gap-1">
              <TriangleAlertIcon aria-hidden className="text-at-risk size-4" />
              {t("legend.warning")}
            </span>
          </span>
        ) : undefined
      }
    />
  );
}
