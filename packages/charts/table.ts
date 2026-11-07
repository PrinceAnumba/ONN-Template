import { formatPeriod } from "@onn/ui/format";
import { donutSlices, linePeriods, stackedValues } from "./options";
import type { ChartSpec, ChartTable } from "./spec";

/** The plotted data as rows, so the table and CSV never disagree with the chart. */
export function chartTable(spec: ChartSpec): ChartTable {
  switch (spec.kind) {
    case "line": {
      const periods = linePeriods(spec);
      const columns = [spec.labels.period, ...spec.series.map((series) => series.name)];
      if (spec.band) columns.push(`${spec.band.name} min`, `${spec.band.name} max`);
      const rows = periods.map((period) => {
        const row: (string | number | null)[] = [
          formatPeriod(period, spec.tag),
          ...spec.series.map(
            (series) => series.points.find((point) => point.period === period)?.value ?? null,
          ),
        ];
        if (spec.band) {
          const band = spec.band.points.find((point) => point.period === period);
          row.push(band?.min ?? null, band?.max ?? null);
        }
        return row;
      });
      return { columns, rows, numeric: columns.map((_, i) => i > 0) };
    }
    case "bar":
      return {
        columns: [spec.labels.category, spec.labels.value],
        rows: spec.items.map((item) => [item.label, item.value]),
        numeric: [false, true],
      };
    case "stacked": {
      const values = stackedValues(spec);
      const columns = [spec.labels.category, ...spec.series.map((series) => series.name)];
      return {
        columns,
        rows: spec.categories.map((category, i) => [category, ...values.map((v) => v[i] ?? null)]),
        numeric: columns.map((_, i) => i > 0),
      };
    }
    case "donut":
      return {
        columns: [spec.labels.category, spec.labels.value],
        rows: donutSlices(spec).map((slice) => [slice.label, slice.value]),
        numeric: [false, true],
      };
    case "radar": {
      const columns = [spec.labels.axis, ...spec.series.map((series) => series.name)];
      return {
        columns,
        rows: spec.axes.map((axis, i) => [axis, ...spec.series.map((s) => s.values[i] ?? null)]),
        numeric: columns.map((_, i) => i > 0),
      };
    }
    case "treemap":
      return {
        columns: [spec.labels.category, spec.labels.value],
        rows: spec.items.map((item) => [item.label, item.value]),
        numeric: [false, true],
      };
  }
}

const cell = (value: string | number | null) => {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function tableToCsv(table: ChartTable) {
  return [table.columns, ...table.rows].map((row) => row.map(cell).join(",")).join("\n");
}
