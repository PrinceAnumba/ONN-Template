"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  ExportJob,
  ReportAdmin,
  ReportBlock,
  ReportComment,
  Widget,
} from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { cn } from "@onn/ui/lib/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChartLineIcon,
  DownloadIcon,
  GaugeIcon,
  GripVerticalIcon,
  LoaderCircleIcon,
  MapIcon,
  TableIcon,
  Trash2Icon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ErrorSummary,
  FIELD,
  FieldMessage,
  focusField,
  type FieldError,
} from "@/components/forms/form-errors";
import { IndicatorPicker } from "@/components/forms/indicator-picker";
import { PreviewFrame, previewSrc, useDebounced } from "@/components/preview/preview-frame";
import { BFF, bff, BffError } from "@/lib/bff";
import { BLOCK_MAX_INDICATORS, BLOCK_TYPES, newId, PERIOD_PATTERN, portalUrl } from "@/lib/content";
import { formatDate } from "@/lib/format";
import type { PickerData } from "@/lib/picker-data";
import { TextBlock } from "./text-block";

const ICONS: Record<ReportBlock["type"], LucideIcon> = {
  text: TypeIcon,
  kpis: GaugeIcon,
  chart: ChartLineIcon,
  map: MapIcon,
  table: TableIcon,
};
const POLL_MS = 1500;
const SLOW_MS = 60_000;
const GIVE_UP_MS = 5 * 60_000;

type BlockError = FieldError & { block?: string; field?: string };
type Exporting = {
  format: "pdf" | "docx";
  progress: number;
  status: ExportJob["status"];
  url?: string;
};

/** What decides whether there is something to save; comments are saved on their own. */
const contentKey = (title: string, period: string, blocks: ReportBlock[]) =>
  JSON.stringify({
    title,
    period,
    blocks: blocks.map((block) =>
      block.type === "text" ? { ...block, comments: undefined } : block,
    ),
  });

/**
 * Report builder (brief §7): ordered blocks (text, KPI grid, chart, map, table) reordered by drag
 * or with move buttons; text in Tiptap with comments and an assignee; data blocks preview live
 * through the portal; "Generate PDF / DOCX" runs an export job with progress.
 */
export function ReportBuilder({ initial, picker }: { initial: ReportAdmin; picker: PickerData }) {
  const t = useTranslations("Admin.reports");
  const locale = useLocale();
  const id = useId();
  const [title, setTitle] = useState(initial.title);
  const [period, setPeriod] = useState(initial.period);
  const [blocks, setBlocks] = useState<ReportBlock[]>(initial.blocks);
  const [saved, setSaved] = useState(() =>
    contentKey(initial.title, initial.period, initial.blocks),
  );
  const [savedIds, setSavedIds] = useState(() => initial.blocks.map((block) => block.id));
  const [errors, setErrors] = useState<BlockError[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<Exporting | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const summary = useRef<HTMLDivElement>(null);
  const cancelled = useRef(false);
  const dirty = contentKey(title, period, blocks) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => () => void (cancelled.current = true), []);

  const indicatorName = useMemo(() => {
    const names = new Map(picker.indicators.map((item) => [item.code, item.name]));
    return (code: string) => names.get(code) ?? code;
  }, [picker.indicators]);

  const fieldId = (path: string) => `${id}-${path.replace(/\W/g, "-")}`;
  const blockFieldId = (block: string, field: string) => fieldId(`b-${block}-${field}`);
  const message = (error: BlockError) =>
    error.field === undefined && error.path === "period" && error.message === "format"
      ? t(`hint.period.${initial.template}`)
      : t(
          `error.${
            ["required", "format", "unknown", "count", "duplicate"].includes(error.message)
              ? (error.message as "required")
              : "invalid"
          }`,
        );
  const errorText = (block: string | undefined, field: string) => {
    const error = errors.find(
      (item) => item.block === block && (item.field ?? item.path) === field,
    );
    return error ? message(error) : undefined;
  };
  const describedBy = (target: string, error: boolean, hint?: string) =>
    [hint, error ? `${target}-error` : undefined].filter(Boolean).join(" ") || undefined;
  const blockLabel = (block: ReportBlock, index: number) =>
    t("blockLabel", { position: index + 1, type: t(`blockType.${block.type}`) });

  const update = (blockId: string, change: Partial<ReportBlock>) =>
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId ? ({ ...block, ...change } as ReportBlock) : block,
      ),
    );

  const add = (type: ReportBlock["type"]) => {
    const blockId = newId(
      "b",
      blocks.map((block) => block.id),
    );
    const first = picker.indicators[0]?.code ?? "";
    const block: ReportBlock =
      type === "text"
        ? { id: blockId, type, html: "", comments: [] }
        : type === "kpis"
          ? {
              id: blockId,
              type,
              indicators: picker.indicators.slice(0, 4).map((item) => item.code),
            }
          : type === "table"
            ? { id: blockId, type, indicators: first ? [first] : [] }
            : { id: blockId, type, indicator: first };
    setBlocks([...blocks, block]);
    setAnnouncement(t("blockAdded", { type: t(`blockType.${type}`), position: blocks.length + 1 }));
    requestAnimationFrame(() => document.getElementById(fieldId(`block-${blockId}`))?.focus());
  };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const moved = blocks[index]!;
    setBlocks(arrayMove(blocks, index, target));
    setAnnouncement(t("blockMoved", { type: t(`blockType.${moved.type}`), position: target + 1 }));
    // Keep focus on the same button of the moved block, or the other one at either end.
    const button = delta < 0 ? "up" : "down";
    const fallback = delta < 0 ? "down" : "up";
    requestAnimationFrame(() => {
      const atEnd = target === 0 || target === blocks.length - 1;
      document.getElementById(fieldId(`${atEnd ? fallback : button}-${moved.id}`))?.focus();
    });
  };
  const remove = (index: number) => {
    const removed = blocks[index]!;
    const rest = blocks.filter((_, position) => position !== index);
    setBlocks(rest);
    setErrors(errors.filter((error) => error.block !== removed.id));
    setAnnouncement(t("blockRemoved", { type: t(`blockType.${removed.type}`) }));
    const next = rest[Math.min(index, rest.length - 1)];
    requestAnimationFrame(() =>
      document.getElementById(next ? fieldId(`block-${next.id}`) : `${id}-add`)?.focus(),
    );
  };

  const save = async () => {
    setBusy(true);
    try {
      const result = await bff<ReportAdmin>(`/reports/${initial.id}`, {
        method: "PUT",
        body: { title, period, blocks },
      });
      setTitle(result.title);
      setPeriod(result.period);
      setBlocks(result.blocks);
      setSaved(contentKey(result.title, result.period, result.blocks));
      setSavedIds(result.blocks.map((block) => block.id));
      setErrors([]);
      showToast(t("saved"));
    } catch (error) {
      if (error instanceof BffError && error.status === 422 && error.errors.length) {
        setErrors(
          error.errors.map((item): BlockError => {
            const match = /^blocks\.(\d+)\.(.+)$/.exec(item.path);
            return match ? { ...item, block: blocks[Number(match[1])]?.id, field: match[2] } : item;
          }),
        );
        requestAnimationFrame(() => summary.current?.focus());
      } else showToast(t("saveFailed"), "error");
    } finally {
      setBusy(false);
    }
  };

  const generate = async (format: "pdf" | "docx") => {
    setExporting({ format, progress: 0, status: "queued" });
    try {
      const { jobId } = await bff<{ jobId: string }>(`/reports/${initial.id}/exports`, {
        method: "POST",
        body: { format },
      });
      const started = Date.now();
      let warned = false;
      while (!cancelled.current) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        const job = await bff<ExportJob>(`/exports/${jobId}`);
        if (job.status === "done" && job.url) {
          const url = `${BFF}${job.url.replace(/^\/admin/, "")}`;
          setExporting({ format, progress: 1, status: "done", url });
          const link = document.createElement("a");
          link.href = url;
          link.download = "";
          link.click();
          return;
        }
        if (job.status === "failed") throw new Error("failed");
        setExporting({ format, progress: job.progress ?? 0, status: job.status });
        if (!warned && Date.now() - started > SLOW_MS) {
          warned = true;
          showToast(t("exportSlow"));
        }
        if (Date.now() - started > GIVE_UP_MS) throw new Error("timeout");
      }
    } catch {
      setExporting(null);
      showToast(t("exportFailed"), "error", { label: t("retry"), onClick: () => generate(format) });
    }
  };

  // ---- Drag and drop ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const position = (blockId: string | number | undefined) =>
    blocks.findIndex((block) => block.id === blockId) + 1;
  const typeOf = (blockId: string | number) => {
    const block = blocks.find((item) => item.id === blockId);
    return block ? t(`blockType.${block.type}`) : String(blockId);
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("dnd.start", { type: typeOf(active.id), position: position(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t("dnd.over", { type: typeOf(active.id), position: position(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      t("dnd.end", { type: typeOf(active.id), position: position(over?.id ?? active.id) }),
    onDragCancel: ({ active }) => t("dnd.cancel", { type: typeOf(active.id) }),
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setBlocks((current) =>
      arrayMove(
        current,
        current.findIndex((block) => block.id === active.id),
        current.findIndex((block) => block.id === over.id),
      ),
    );
  };

  const summaryItems = errors.map((error) => {
    const index = blocks.findIndex((block) => block.id === error.block);
    const field = error.field ?? error.path;
    const target = index >= 0 ? blockFieldId(error.block!, field) : fieldId(field);
    return {
      href: `#${target}`,
      text:
        index >= 0
          ? t("errorLineBlock", {
              block: blockLabel(blocks[index]!, index),
              field: t(`field.${field as "indicator"}`),
              message: message(error),
            })
          : t("errorLine", { field: t(`field.${field as "title"}`), message: message(error) }),
      onClick: () => focusField(target),
    };
  });

  const exportBlocked = dirty;
  return (
    <div className="mt-2 flex flex-col gap-6">
      <div>
        <h1 className="text-h1 break-words">{title || initial.title}</h1>
        <p className="text-muted-foreground mt-1">
          {t("meta", {
            template: t(`templateInline.${initial.template}`),
            author: initial.createdBy.name,
            date: formatDate(initial.updated, locale, "medium"),
          })}
        </p>
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <ErrorSummary
        ref={summary}
        title={t("errorTitle", { count: errors.length })}
        items={summaryItems}
      />

      <div className="grid max-w-3xl gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
        <div>
          <label htmlFor={fieldId("title")} className="mb-1 block font-semibold">
            {t("field.title")}
          </label>
          <input
            id={fieldId("title")}
            className={FIELD}
            value={title}
            aria-invalid={Boolean(errorText(undefined, "title"))}
            aria-describedby={describedBy(fieldId("title"), Boolean(errorText(undefined, "title")))}
            onChange={(event) => setTitle(event.target.value)}
          />
          <FieldMessage id={`${fieldId("title")}-error`} text={errorText(undefined, "title")} />
        </div>
        <div>
          <label htmlFor={fieldId("period")} className="mb-1 block font-semibold">
            {t("field.period")}
          </label>
          <input
            id={fieldId("period")}
            className={`${FIELD} font-mono`}
            value={period}
            autoComplete="off"
            aria-invalid={Boolean(errorText(undefined, "period"))}
            aria-describedby={describedBy(
              fieldId("period"),
              Boolean(errorText(undefined, "period")),
              PERIOD_PATTERN[initial.template] ? `${fieldId("period")}-hint` : undefined,
            )}
            onChange={(event) => setPeriod(event.target.value.toUpperCase())}
          />
          <p id={`${fieldId("period")}-hint`} className="text-muted-foreground mt-1 text-sm">
            {t(`hint.period.${initial.template}`)}
          </p>
          <FieldMessage id={`${fieldId("period")}-error`} text={errorText(undefined, "period")} />
        </div>
      </div>

      <section aria-labelledby={`${id}-blocks`}>
        <h2 id={`${id}-blocks`} className="text-h3">
          {t("blocks")}
        </h2>
        <DndContext
          id={`${id}-dnd`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: t("dnd.instructions") },
          }}
        >
          <SortableContext
            items={blocks.map((block) => block.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="mt-3 flex flex-col gap-4">
              {blocks.map((block, index) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  headingId={fieldId(`block-${block.id}`)}
                  label={blockLabel(block, index)}
                  errorCount={errors.filter((error) => error.block === block.id).length}
                  labels={{
                    drag: t("dragHandle", { block: blockLabel(block, index) }),
                    up: t("moveUp", { block: blockLabel(block, index) }),
                    down: t("moveDown", { block: blockLabel(block, index) }),
                    remove: t("removeBlock", { block: blockLabel(block, index) }),
                    errors: t("blockErrors", {
                      count: errors.filter((error) => error.block === block.id).length,
                    }),
                  }}
                  upId={fieldId(`up-${block.id}`)}
                  downId={fieldId(`down-${block.id}`)}
                  first={index === 0}
                  last={index === blocks.length - 1}
                  onMove={(delta) => move(index, delta)}
                  onRemove={() => remove(index)}
                >
                  <BlockBody
                    block={block}
                    reportId={initial.id}
                    picker={picker}
                    people={initial.people}
                    saved={savedIds.includes(block.id)}
                    indicatorName={indicatorName}
                    fieldId={(field) => blockFieldId(block.id, field)}
                    errorText={(field) => errorText(block.id, field)}
                    describedBy={describedBy}
                    onChange={(change) => update(block.id, change)}
                    onComments={(comments) => {
                      update(block.id, { comments } as Partial<ReportBlock>);
                    }}
                  />
                </BlockCard>
              ))}
            </ol>
          </SortableContext>
        </DndContext>
        <div
          id={`${id}-add`}
          tabIndex={-1}
          role="group"
          aria-labelledby={`${id}-add-label`}
          className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3"
        >
          <span id={`${id}-add-label`} className="font-semibold">
            {t("addBlock")}
          </span>
          {BLOCK_TYPES.map((type) => {
            const Icon = ICONS[type];
            return (
              <Button key={type} variant="secondary" onClick={() => add(type)}>
                <Icon aria-hidden="true" className="size-4" />
                {t(`blockType.${type}`)}
              </Button>
            );
          })}
        </div>
      </section>

      <div className="bg-background sticky bottom-0 z-20 border-t">
        <div className="flex flex-wrap items-center gap-3 py-3">
          <Button onClick={save} disabled={busy || !dirty}>
            {busy && <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />}
            {t("save")}
          </Button>
          <p aria-live="polite" className="text-muted-foreground text-sm">
            {dirty ? t("unsaved") : t("allSaved")}
          </p>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {exporting && exporting.status !== "done" ? (
              <div className="flex min-w-48 items-center gap-2">
                <div
                  role="progressbar"
                  aria-label={t("exportProgress", { format: t(`format.${exporting.format}`) })}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(exporting.progress * 100)}
                  className="bg-surface-2 h-2 flex-1 overflow-hidden rounded-pill"
                >
                  <div
                    className="bg-primary h-full transition-[width]"
                    style={{ width: `${Math.max(4, exporting.progress * 100)}%` }}
                  />
                </div>
                <span className="text-sm whitespace-nowrap" aria-live="polite">
                  {t(`exportStatus.${exporting.status}`, {
                    format: t(`format.${exporting.format}`),
                  })}
                </span>
              </div>
            ) : (
              <>
                {exporting?.url && (
                  <a
                    href={exporting.url}
                    className="inline-flex h-11 items-center gap-2 px-2 underline"
                  >
                    <DownloadIcon aria-hidden="true" className="size-4" />
                    {t("download", { format: t(`format.${exporting.format}`) })}
                  </a>
                )}
                {(["pdf", "docx"] as const).map((format) => (
                  <Button
                    key={format}
                    variant="secondary"
                    aria-disabled={exportBlocked || undefined}
                    aria-describedby={exportBlocked ? `${id}-export-reason` : undefined}
                    className={exportBlocked ? "cursor-not-allowed opacity-60" : undefined}
                    onClick={() => !exportBlocked && generate(format)}
                  >
                    {t("generate", { format: t(`format.${format}`) })}
                  </Button>
                ))}
                {exportBlocked && (
                  <span id={`${id}-export-reason`} className="text-muted-foreground text-sm">
                    {t("saveBeforeExport")}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One block: drag handle, heading, move and remove buttons around its editor. */
function BlockCard({
  block,
  headingId,
  label,
  errorCount,
  labels,
  upId,
  downId,
  first,
  last,
  onMove,
  onRemove,
  children,
}: {
  block: ReportBlock;
  headingId: string;
  label: string;
  errorCount: number;
  labels: { drag: string; up: string; down: string; remove: string; errors: string };
  upId: string;
  downId: string;
  first: boolean;
  last: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const Icon = ICONS[block.type];
  const icon = "hover:bg-surface-2 inline-flex size-11 items-center justify-center rounded-md";
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "bg-card rounded-lg border p-3",
        errorCount > 0 && "border-destructive border-2",
        isDragging && "relative z-10 shadow-lg",
      )}
    >
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={labels.drag}
          className={cn(icon, "text-muted-foreground cursor-grab touch-none")}
        >
          <GripVerticalIcon aria-hidden="true" className="size-4" />
        </button>
        <h3
          id={headingId}
          tabIndex={-1}
          className="flex min-w-0 flex-1 items-center gap-2 font-semibold"
        >
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{label}</span>
          {errorCount > 0 && <span className="text-destructive text-sm">{labels.errors}</span>}
        </h3>
        {!first && (
          <button
            id={upId}
            type="button"
            aria-label={labels.up}
            onClick={() => onMove(-1)}
            className={icon}
          >
            <ArrowUpIcon aria-hidden="true" className="size-4" />
          </button>
        )}
        {!last && (
          <button
            id={downId}
            type="button"
            aria-label={labels.down}
            onClick={() => onMove(1)}
            className={icon}
          >
            <ArrowDownIcon aria-hidden="true" className="size-4" />
          </button>
        )}
        <button
          type="button"
          aria-label={labels.remove}
          onClick={onRemove}
          className={cn(icon, "text-destructive")}
        >
          <Trash2Icon aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </li>
  );
}

/** The editor for one block type, with a live preview for data blocks. */
function BlockBody({
  block,
  reportId,
  picker,
  people,
  saved,
  indicatorName,
  fieldId,
  errorText,
  describedBy,
  onChange,
  onComments,
}: {
  block: ReportBlock;
  reportId: string;
  picker: PickerData;
  people: ReportAdmin["people"];
  saved: boolean;
  indicatorName: (code: string) => string;
  fieldId: (field: string) => string;
  errorText: (field: string) => string | undefined;
  describedBy: (target: string, error: boolean, hint?: string) => string | undefined;
  onChange: (change: Partial<ReportBlock>) => void;
  onComments: (comments: ReportComment[]) => void;
}) {
  const t = useTranslations("Admin.reports");
  const locale = useLocale();
  const src = useDebounced(
    useMemo(() => blockPreview(block, locale, indicatorName), [block, locale, indicatorName]),
  );

  if (block.type === "text") {
    return (
      <TextBlock
        reportId={reportId}
        blockId={block.id}
        html={block.html}
        assignee={block.assignee}
        comments={block.comments}
        people={people}
        saved={saved}
        fieldId={fieldId}
        errorText={errorText}
        onChange={(change) => onChange(change as Partial<ReportBlock>)}
        onComments={onComments}
      />
    );
  }

  const years = (field: "years" | "year") => {
    const value =
      field === "year"
        ? block.type === "map"
          ? block.year
          : undefined
        : "years" in block
          ? block.years
          : undefined;
    const error = errorText(field);
    return (
      <div>
        <label htmlFor={fieldId(field)} className="mb-1 block font-semibold">
          {t(`field.${field}`)}
        </label>
        <input
          id={fieldId(field)}
          className={`${FIELD} max-w-40 font-mono`}
          value={value ?? ""}
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(fieldId(field), Boolean(error), `${fieldId(field)}-hint`)}
          onChange={(event) =>
            onChange({ [field]: event.target.value.trim() || undefined } as Partial<ReportBlock>)
          }
        />
        <p id={`${fieldId(field)}-hint`} className="text-muted-foreground mt-1 text-sm">
          {t(`hint.${field}`)}
        </p>
        <FieldMessage id={`${fieldId(field)}-error`} text={error} />
      </div>
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        {block.type === "kpis" || block.type === "table" ? (
          <IndicatorPicker
            id={fieldId("indicators")}
            label={t("field.indicators")}
            indicators={picker.indicators}
            value={block.indicators}
            max={BLOCK_MAX_INDICATORS[block.type]}
            error={errorText("indicators")}
            onChange={(indicators) => onChange({ indicators })}
          />
        ) : (
          <IndicatorPicker
            id={fieldId("indicator")}
            label={t("field.indicator")}
            indicators={picker.indicators}
            value={block.indicator ? [block.indicator] : []}
            max={1}
            error={errorText("indicator")}
            onChange={(codes) => onChange({ indicator: codes[0] ?? "" })}
          />
        )}
        {block.type === "chart" && (
          <div>
            <label htmlFor={fieldId("area")} className="mb-1 block font-semibold">
              {t("field.area")}
            </label>
            <select
              id={fieldId("area")}
              className={FIELD}
              value={block.area ?? ""}
              onChange={(event) => onChange({ area: event.target.value || undefined })}
            >
              <option value="">{t("nationalArea")}</option>
              {picker.areas.slice(1).map((area) => (
                <option key={area.code} value={area.code}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {(block.type === "chart" || block.type === "table") && years("years")}
        {block.type === "map" && years("year")}
      </div>
      <div className="min-w-0">
        <p className="mb-1 font-semibold">{t("preview")}</p>
        {src ? (
          <PreviewFrame
            src={src}
            title={t("previewTitle", { type: t(`blockType.${block.type}`) })}
          />
        ) : (
          <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
            {t("previewEmpty")}
          </p>
        )}
      </div>
    </div>
  );
}

/** Portal embed address that draws a data block: the chart embed, or dashboard widgets. */
function blockPreview(
  block: ReportBlock,
  locale: string,
  name: (code: string) => string,
): string | null {
  switch (block.type) {
    case "text":
      return null;
    case "chart": {
      if (!block.indicator) return null;
      const query = new URLSearchParams({ i: block.indicator });
      if (block.area) query.set("a", block.area);
      if (block.years) query.set("y", block.years);
      return portalUrl(`/${locale}/embed/chart?${query}`);
    }
    case "kpis":
      return previewSrc(
        locale,
        block.indicators.map((code, index): Widget => ({
          id: `k${index}`,
          type: "kpi",
          title: name(code),
          indicators: [code],
          span: 1,
        })),
      );
    case "map":
      return block.indicator
        ? previewSrc(locale, [
            {
              id: "m",
              type: "map",
              title: name(block.indicator),
              indicators: [block.indicator],
              span: 3,
              ...(block.year ? { years: block.year } : {}),
            },
          ])
        : null;
    case "table":
      return block.indicators.length
        ? previewSrc(locale, [
            {
              id: "t",
              type: "table",
              title: block.indicators.map(name).join(", "),
              indicators: block.indicators,
              span: 3,
              ...(block.years ? { years: block.years } : {}),
            },
          ])
        : null;
  }
}
