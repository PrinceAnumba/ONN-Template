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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AdminWidget, DashboardAdmin, DashboardRecord, Widget } from "@onn/api-client/types";
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
import { cn } from "@onn/ui/lib/utils";
import {
  ChartBarIcon,
  ChartColumnStackedIcon,
  ChartLineIcon,
  ChartPieIcon,
  ExternalLinkIcon,
  GaugeIcon,
  GripVerticalIcon,
  LayoutGridIcon,
  LoaderCircleIcon,
  MapIcon,
  MoveHorizontalIcon,
  RadarIcon,
  SquareStackIcon,
  TableIcon,
  TargetIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ErrorSummary,
  FIELD,
  FieldMessage,
  focusField,
  type FieldError,
} from "@/components/forms/form-errors";
import { IndicatorPicker } from "@/components/forms/indicator-picker";
import { PreviewFrame, previewSrc, useDebounced } from "@/components/preview/preview-frame";
import { bff, BffError } from "@/lib/bff";
import {
  AUDIENCES,
  CONTENT_TONE,
  newId,
  portalUrl,
  WIDGET_BREAKDOWN,
  WIDGET_MAX_INDICATORS,
  WIDGET_TYPES,
} from "@/lib/content";
import { useLanguageName } from "@/lib/languages";
import type { PickerData } from "@/lib/picker-data";

const ICONS: Record<Widget["type"], LucideIcon> = {
  kpi: GaugeIcon,
  line: ChartLineIcon,
  bar: ChartBarIcon,
  stacked: ChartColumnStackedIcon,
  donut: ChartPieIcon,
  radar: RadarIcon,
  treemap: SquareStackIcon,
  map: MapIcon,
  table: TableIcon,
  target: TargetIcon,
  text: TypeIcon,
};
const DEFAULT_SPAN: Partial<Record<Widget["type"], 1 | 2 | 3>> = {
  line: 2,
  stacked: 2,
  treemap: 2,
  map: 3,
  table: 3,
  text: 3,
};
const SPAN_CLASS = { 1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3" } as const;
const AREA = "border-input bg-background min-h-24 w-full rounded-md border px-3 py-2";

type BuilderError = FieldError & { widget?: string; field?: string };

const record = (item: DashboardRecord): DashboardRecord => ({
  title: item.title,
  description: item.description,
  audience: item.audience,
  widgets: item.widgets,
});

interface DashboardBuilderProps {
  initial: DashboardAdmin;
  picker: PickerData;
  locales: string[];
  defaultLocale: string;
}

/**
 * Dashboard builder (brief §7): widget palette, a 3-column grid with drag-and-drop (dnd-kit,
 * keyboard included) and resizing to span 1–3, widget settings, and a live preview drawn by the
 * portal itself. Saving keeps a draft; publishing makes the portal show it.
 */
export function DashboardBuilder({
  initial,
  picker,
  locales,
  defaultLocale,
}: DashboardBuilderProps) {
  const t = useTranslations("Admin.dashboards");
  const common = useTranslations("Common");
  const uiLocale = useLocale();
  const languageName = useLanguageName();
  const id = useId();
  const [draft, setDraft] = useState<DashboardRecord>(() => record(initial));
  const [saved, setSaved] = useState(() => JSON.stringify(record(initial)));
  const [status, setStatus] = useState(initial.status);
  const [selected, setSelected] = useState<string | null>(initial.widgets[0]?.id ?? null);
  const [errors, setErrors] = useState<BuilderError[]>([]);
  const [busy, setBusy] = useState<"save" | "publish" | "unpublish" | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [previewLocale, setPreviewLocale] = useState(
    locales.includes(uiLocale) ? uiLocale : defaultLocale,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const restoreFocus = useRestoreFocus(confirmUnpublish);
  // After unpublishing, the button that opened the dialog is gone; focus moves to Publish.
  const publishButton = useRef<HTMLButtonElement>(null);
  const unpublishedNow = useRef(false);
  const summary = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(draft) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const indicatorName = useMemo(() => {
    const names = new Map(picker.indicators.map((item) => [item.code, item.name]));
    return (code: string) => names.get(code) ?? code;
  }, [picker.indicators]);
  const pick = (text: Record<string, string> | undefined, locale: string) =>
    text?.[locale] || text?.[defaultLocale] || "";
  const widgetTitle = (widget: AdminWidget) =>
    pick(widget.title, uiLocale) || t(`type.${widget.type}`);
  const resolve = useCallback(
    (widget: AdminWidget, locale: string): Widget => ({
      ...widget,
      title: widget.title[locale] || widget.title[defaultLocale] || "",
      body: widget.body ? widget.body[locale] || widget.body[defaultLocale] || "" : undefined,
    }),
    [defaultLocale],
  );

  const fieldId = (path: string) => `${id}-${path.replace(/\W/g, "-")}`;
  const widgetFieldId = (widget: string, field: string) => fieldId(`w-${widget}-${field}`);
  const widgetErrors = (widget: string) => errors.filter((error) => error.widget === widget);
  const errorFor = (widget: string | undefined, field: string) =>
    errors.find((error) => error.widget === widget && (error.field ?? error.path) === field);
  const message = (error: FieldError) =>
    t(
      `error.${
        ["required", "duplicate", "format", "unknown", "count", "order", "range"].includes(
          error.message,
        )
          ? (error.message as "required")
          : "invalid"
      }`,
    );
  const errorText = (widget: string | undefined, field: string) => {
    const error = errorFor(widget, field);
    return error ? message(error) : undefined;
  };
  const describedBy = (target: string, error: boolean, hint?: string) =>
    [hint, error ? `${target}-error` : undefined].filter(Boolean).join(" ") || undefined;
  const fieldLabel = (field: string) => {
    const [name, locale] = field.split(".");
    const base = t(`field.${(name ?? field) as "title"}`);
    return locale ? t("fieldIn", { field: base, language: languageName(locale) }) : base;
  };

  const updateWidget = (widgetId: string, change: Partial<AdminWidget>) =>
    setDraft((current) => ({
      ...current,
      widgets: current.widgets.map((widget) =>
        widget.id === widgetId ? { ...widget, ...change } : widget,
      ),
    }));

  const addWidget = (type: Widget["type"]) => {
    const widgetId = newId(
      "w",
      draft.widgets.map((widget) => widget.id),
    );
    const widget: AdminWidget = {
      id: widgetId,
      type,
      title: { [defaultLocale]: t(`type.${type}`) },
      indicators: type === "text" ? [] : picker.indicators[0] ? [picker.indicators[0].code] : [],
      span: DEFAULT_SPAN[type] ?? 1,
      ...(type === "text" ? { body: {} } : {}),
    };
    setDraft((current) => ({ ...current, widgets: [...current.widgets, widget] }));
    setSelected(widgetId);
    setView("edit");
    setAnnouncement(t("added", { type: t(`type.${type}`), count: draft.widgets.length + 1 }));
  };

  const removeWidget = (widgetId: string) => {
    const index = draft.widgets.findIndex((widget) => widget.id === widgetId);
    const rest = draft.widgets.filter((widget) => widget.id !== widgetId);
    setDraft({ ...draft, widgets: rest });
    setErrors(errors.filter((error) => error.widget !== widgetId));
    const next = rest[Math.min(index, rest.length - 1)];
    setSelected(next?.id ?? null);
    setAnnouncement(t("removed"));
    requestAnimationFrame(() =>
      document
        .getElementById(next ? fieldId(`card-${next.id}`) : `${id}-palette`)
        ?.querySelector<HTMLElement>("[data-select]")
        ?.focus(),
    );
  };

  const changeType = (widget: AdminWidget, type: Widget["type"]) => {
    const max = WIDGET_MAX_INDICATORS[type] ?? 1;
    const indicators =
      type === "text"
        ? []
        : widget.indicators.length
          ? widget.indicators.slice(0, max)
          : picker.indicators[0]
            ? [picker.indicators[0].code]
            : [];
    updateWidget(widget.id, {
      type,
      indicators,
      body: type === "text" ? (widget.body ?? {}) : undefined,
      dims: WIDGET_BREAKDOWN.includes(type) ? widget.dims : undefined,
      compare: type === "line" ? widget.compare : undefined,
    });
  };

  const setSpan = (widgetId: string, span: number) => {
    const next = Math.min(3, Math.max(1, span)) as 1 | 2 | 3;
    updateWidget(widgetId, { span: next });
    setAnnouncement(t("resized", { span: next }));
  };

  // ---- Saving ----
  const fail = (error: unknown, widgets: AdminWidget[]) => {
    if (error instanceof BffError && error.status === 422 && error.errors.length) {
      const mapped = error.errors.map((item): BuilderError => {
        const match = /^widgets\.(\d+)\.(.+)$/.exec(item.path);
        if (!match) return item;
        return { ...item, widget: widgets[Number(match[1])]?.id, field: match[2] };
      });
      setErrors(mapped);
      if (mapped.some((item) => !item.widget)) setDetailsOpen(true);
      requestAnimationFrame(() => summary.current?.focus());
    } else if (error instanceof BffError && error.type === "empty") {
      showToast(t("publishEmpty"), "error");
    } else {
      showToast(t("saveFailed"), "error");
    }
  };

  const save = async () => {
    const body = draft;
    const result = await bff<DashboardAdmin>(`/dashboards/${initial.slug}`, {
      method: "PUT",
      body,
    });
    setSaved(JSON.stringify(record(result)));
    setDraft(record(result));
    setStatus(result.status);
    setErrors([]);
    return result;
  };

  const onSave = async () => {
    setBusy("save");
    try {
      await save();
      showToast(t("saved"));
    } catch (error) {
      fail(error, draft.widgets);
    } finally {
      setBusy(null);
    }
  };

  const onPublish = async () => {
    setBusy("publish");
    try {
      if (dirty) await save();
      const result = await bff<DashboardAdmin>(`/dashboards/${initial.slug}/publish`, {
        method: "POST",
      });
      setStatus(result.status);
      setErrors([]);
      showToast(t("published"));
    } catch (error) {
      fail(error, draft.widgets);
    } finally {
      setBusy(null);
    }
  };

  const onUnpublish = async () => {
    setBusy("unpublish");
    try {
      const result = await bff<DashboardAdmin>(`/dashboards/${initial.slug}/unpublish`, {
        method: "POST",
      });
      unpublishedNow.current = true;
      setStatus(result.status);
      setConfirmUnpublish(false);
      showToast(t("unpublished"));
    } catch {
      showToast(t("saveFailed"), "error");
    } finally {
      setBusy(null);
    }
  };

  // ---- Drag and drop ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const position = (widgetId: string | number | undefined) =>
    draft.widgets.findIndex((widget) => widget.id === widgetId) + 1;
  const nameOf = (widgetId: string | number) => {
    const widget = draft.widgets.find((item) => item.id === widgetId);
    return widget ? widgetTitle(widget) : String(widgetId);
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("dnd.start", { title: nameOf(active.id), position: position(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t("dnd.over", { title: nameOf(active.id), position: position(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      t("dnd.end", { title: nameOf(active.id), position: position(over?.id ?? active.id) }),
    onDragCancel: ({ active }) => t("dnd.cancel", { title: nameOf(active.id) }),
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setDraft((current) => {
      const from = current.widgets.findIndex((widget) => widget.id === active.id);
      const to = current.widgets.findIndex((widget) => widget.id === over.id);
      return { ...current, widgets: arrayMove(current.widgets, from, to) };
    });
  };

  // ---- Preview ----
  const allSrc = useDebounced(
    useMemo(
      () =>
        previewSrc(
          previewLocale,
          draft.widgets.map((widget) => resolve(widget, previewLocale)),
        ),
      [draft.widgets, previewLocale, resolve],
    ),
  );
  const current = draft.widgets.find((widget) => widget.id === selected) ?? null;
  const oneSrc = useDebounced(
    useMemo(
      () =>
        current
          ? previewSrc(previewLocale, [resolve({ ...current, span: 3 }, previewLocale)])
          : null,
      [current, previewLocale, resolve],
    ),
  );

  const summaryItems = errors.map((error) => {
    const widget = draft.widgets.find((item) => item.id === error.widget);
    const field = error.field ?? error.path;
    const target = widget ? widgetFieldId(widget.id, field) : fieldId(field);
    return {
      href: `#${target}`,
      text: widget
        ? t("errorLineWidget", {
            widget: widgetTitle(widget),
            field: fieldLabel(
              field.replace(/^(indicators|span|years|area|compare|type|id).*$/, "$1"),
            ),
            message: message(error),
          })
        : t("errorLine", { field: fieldLabel(field), message: message(error) }),
      onClick: () => {
        if (widget) {
          setSelected(widget.id);
          setView("edit");
        } else setDetailsOpen(true);
        focusField(target);
      },
    };
  });

  const title = pick(draft.title, uiLocale) || initial.slug;
  const languagePicker = (
    <div className="flex items-center gap-2">
      <label htmlFor={`${id}-preview-locale`} className="text-sm font-semibold">
        {t("previewLanguage")}
      </label>
      <select
        id={`${id}-preview-locale`}
        className="border-input bg-background h-11 rounded-md border px-2"
        value={previewLocale}
        onChange={(event) => setPreviewLocale(event.target.value)}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {languageName(code)}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="mt-2 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-h1 break-words">{title}</h1>
            <StatusPill tone={CONTENT_TONE[status]} label={t(`status.${status}`)} />
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{initial.slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status !== "draft" && (
            <a
              href={portalUrl(`/${uiLocale}/dashboards/${initial.slug}`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-md px-3 underline"
            >
              {t("viewOnPortal")}
              <ExternalLinkIcon aria-hidden="true" className="size-4" />
              <span className="sr-only">{t("newWindow")}</span>
            </a>
          )}
          {status !== "draft" && (
            <Button
              variant="secondary"
              onClick={() => setConfirmUnpublish(true)}
              disabled={busy !== null}
            >
              {t("unpublish")}
            </Button>
          )}
          <Button variant="secondary" onClick={onSave} disabled={busy !== null || !dirty}>
            {busy === "save" && (
              <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
            )}
            {t("save")}
          </Button>
          <Button
            ref={publishButton}
            onClick={onPublish}
            disabled={busy !== null || (status === "published" && !dirty)}
          >
            {busy === "publish" && (
              <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
            )}
            {status === "draft" ? t("publish") : t("publishChanges")}
          </Button>
        </div>
      </div>
      <p aria-live="polite" className="text-muted-foreground -mt-4 text-sm">
        {dirty ? t("unsaved") : status === "changed" ? t("changedNotice") : ""}
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ErrorSummary
        ref={summary}
        title={t("errorTitle", { count: errors.length })}
        items={summaryItems}
      />

      <details
        open={detailsOpen}
        onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
        className="rounded-lg border"
      >
        <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">
          {t("details")}
        </summary>
        <div className="flex flex-col gap-4 border-t p-4">
          <fieldset>
            <legend className="font-semibold">{t("field.title")}</legend>
            <div className="mt-2 grid gap-4 md:grid-cols-3">
              {locales.map((code) => {
                const path = `title.${code}`;
                const error = errorText(undefined, path);
                return (
                  <div key={code}>
                    <label htmlFor={fieldId(path)} className="mb-1 block text-sm">
                      {languageName(code)}
                      {code === defaultLocale && ` ${t("requiredSuffix")}`}
                    </label>
                    <input
                      id={fieldId(path)}
                      lang={code}
                      className={FIELD}
                      value={draft.title[code] ?? ""}
                      aria-invalid={Boolean(error)}
                      aria-describedby={describedBy(fieldId(path), Boolean(error))}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          title: { ...draft.title, [code]: event.target.value },
                        })
                      }
                    />
                    <FieldMessage id={`${fieldId(path)}-error`} text={error} />
                  </div>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="font-semibold">{t("field.description")}</legend>
            <div className="mt-2 grid gap-4 md:grid-cols-3">
              {locales.map((code) => (
                <div key={code}>
                  <label htmlFor={fieldId(`description.${code}`)} className="mb-1 block text-sm">
                    {languageName(code)}
                  </label>
                  <textarea
                    id={fieldId(`description.${code}`)}
                    lang={code}
                    className={AREA}
                    value={draft.description[code] ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        description: { ...draft.description, [code]: event.target.value },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </fieldset>
          <div className="max-w-xs">
            <label htmlFor={fieldId("audience")} className="mb-1 block font-semibold">
              {t("field.audience")}
            </label>
            <select
              id={fieldId("audience")}
              className={FIELD}
              value={draft.audience}
              onChange={(event) =>
                setDraft({ ...draft, audience: event.target.value as DashboardRecord["audience"] })
              }
            >
              {AUDIENCES.map((audience) => (
                <option key={audience} value={audience}>
                  {t(`audience.${audience}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_22rem]">
        <section id={`${id}-palette`} aria-labelledby={`${id}-palette-title`}>
          <h2 id={`${id}-palette-title`} className="text-h4">
            {t("palette")}
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {WIDGET_TYPES.map((type) => {
              const Icon = ICONS[type];
              return (
                <li key={type}>
                  <button
                    type="button"
                    data-select
                    onClick={() => addWidget(type)}
                    aria-label={t("add", { type: t(`type.${type}`) })}
                    className="hover:bg-surface-2 flex min-h-11 w-full items-center gap-2 rounded-md border px-3 text-start text-sm"
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {t(`type.${type}`)}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby={`${id}-layout-title`} className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${id}-layout-title`} className="text-h4">
              {t("layout")}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {view === "preview" && languagePicker}
              <div role="group" aria-label={t("view")} className="flex rounded-md border p-0.5">
                {(["edit", "preview"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={view === mode}
                    onClick={() => setView(mode)}
                    className={cn(
                      "min-h-10 rounded px-3 text-sm",
                      view === mode && "bg-primary text-primary-foreground font-semibold",
                    )}
                  >
                    {t(`viewMode.${mode}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {view === "edit" ? (
            draft.widgets.length === 0 ? (
              <div className="text-muted-foreground mt-3 flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center">
                <LayoutGridIcon aria-hidden="true" className="size-8" />
                <p>{t("emptyGrid")}</p>
              </div>
            ) : (
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
                  items={draft.widgets.map((widget) => widget.id)}
                  strategy={rectSortingStrategy}
                >
                  <div ref={grid} className="mt-3 grid gap-3 md:grid-cols-3">
                    {draft.widgets.map((widget, index) => (
                      <WidgetCard
                        key={widget.id}
                        domId={fieldId(`card-${widget.id}`)}
                        widget={widget}
                        title={widgetTitle(widget)}
                        typeLabel={t(`type.${widget.type}`)}
                        indicators={widget.indicators.map(indicatorName)}
                        selected={widget.id === selected}
                        errorCount={widgetErrors(widget.id).length}
                        grid={grid}
                        labels={{
                          drag: t("dragHandle", {
                            title: widgetTitle(widget),
                            position: index + 1,
                          }),
                          resize: t("resize", { span: widget.span }),
                          errors: t("widgetErrors", { count: widgetErrors(widget.id).length }),
                          width: t("widthValue", { span: widget.span }),
                        }}
                        onSelect={() => setSelected(widget.id)}
                        onSpan={(span) => setSpan(widget.id, span)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )
          ) : allSrc ? (
            <PreviewFrame src={allSrc} title={t("previewTitle")} minHeight={320} className="mt-3" />
          ) : (
            <p className="text-muted-foreground mt-3">
              {draft.widgets.length ? t("previewTooLong") : t("emptyGrid")}
            </p>
          )}
        </section>

        <section
          aria-labelledby={`${id}-settings-title`}
          className="min-w-0 lg:col-span-2 xl:col-span-1"
        >
          <h2 id={`${id}-settings-title`} className="text-h4">
            {current ? t("settingsFor", { title: widgetTitle(current) }) : t("settings")}
          </h2>
          {current ? (
            <WidgetSettings
              key={current.id}
              widget={current}
              picker={picker}
              locales={locales}
              defaultLocale={defaultLocale}
              fieldId={(field) => widgetFieldId(current.id, field)}
              errorText={(field) => errorText(current.id, field)}
              describedBy={describedBy}
              onChange={(change) => updateWidget(current.id, change)}
              onType={(type) => changeType(current, type)}
              onSpan={(span) => setSpan(current.id, span)}
              onRemove={() => removeWidget(current.id)}
              preview={
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{t("widgetPreview")}</h3>
                    {view === "edit" && languagePicker}
                  </div>
                  {oneSrc ? (
                    <PreviewFrame
                      src={oneSrc}
                      title={t("widgetPreviewTitle", { title: widgetTitle(current) })}
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">{t("previewTooLong")}</p>
                  )}
                </div>
              }
            />
          ) : (
            <p className="text-muted-foreground mt-2">{t("selectHint")}</p>
          )}
        </section>
      </div>

      <Dialog
        open={confirmUnpublish}
        onOpenChange={(next) => busy !== "unpublish" && setConfirmUnpublish(next)}
      >
        <DialogContent
          closeLabel={common("close")}
          onCloseAutoFocus={(event) => {
            if (!unpublishedNow.current) return restoreFocus(event);
            unpublishedNow.current = false;
            event.preventDefault();
            publishButton.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("unpublishTitle")}</DialogTitle>
            <DialogDescription>{t("unpublishDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmUnpublish(false)}>
              {t("cancel")}
            </Button>
            <Button variant="danger" onClick={onUnpublish} disabled={busy === "unpublish"}>
              {busy === "unpublish" && (
                <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
              )}
              {t("unpublish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** One widget in the grid: drag handle, select button and resize handle. */
function WidgetCard({
  domId,
  widget,
  title,
  typeLabel,
  indicators,
  selected,
  errorCount,
  grid,
  labels,
  onSelect,
  onSpan,
}: {
  domId: string;
  widget: AdminWidget;
  title: string;
  typeLabel: string;
  indicators: string[];
  selected: boolean;
  errorCount: number;
  grid: React.RefObject<HTMLDivElement | null>;
  labels: { drag: string; resize: string; errors: string; width: string };
  onSelect: () => void;
  onSpan: (span: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });
  const card = useRef<HTMLDivElement | null>(null);
  const Icon = ICONS[widget.type];

  // Pointer resize: the span follows the pointer in whole grid columns.
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const box = card.current?.getBoundingClientRect();
    const width = grid.current?.getBoundingClientRect().width;
    if (!box || !width) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const column = width / 3;
    const move = (moveEvent: globalThis.PointerEvent) => {
      const extent = rtl ? box.right - moveEvent.clientX : moveEvent.clientX - box.left;
      const span = Math.min(3, Math.max(1, Math.round(extent / column)));
      if (span !== widget.span) onSpan(span);
    };
    const target = event.currentTarget;
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };
  const onResizeKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const grow = rtl ? "ArrowLeft" : "ArrowRight";
    const shrink = rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key === grow) onSpan(widget.span + 1);
    else if (event.key === shrink) onSpan(widget.span - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div
      id={domId}
      ref={(node) => {
        setNodeRef(node);
        card.current = node;
      }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "bg-card relative flex min-h-32 min-w-0 flex-col rounded-lg border p-2",
        SPAN_CLASS[widget.span],
        selected && "border-primary border-2",
        errorCount > 0 && "border-destructive border-2",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={labels.drag}
          className="text-muted-foreground hover:bg-surface-2 inline-flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md"
        >
          <GripVerticalIcon aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          data-select
          onClick={onSelect}
          aria-pressed={selected}
          className="hover:bg-surface-2 flex min-h-11 min-w-0 flex-1 flex-col items-start rounded-md px-2 py-1 text-start"
        >
          <span className="w-full truncate font-semibold">{title}</span>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Icon aria-hidden="true" className="size-3.5" />
            {typeLabel}
          </span>
        </button>
      </div>
      <p className="text-muted-foreground mt-1 line-clamp-2 px-2 text-xs">
        {indicators.join(", ")}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 px-2 pt-2">
        {errorCount > 0 ? (
          <span className="text-destructive text-xs font-semibold">{labels.errors}</span>
        ) : (
          <span className="text-muted-foreground text-xs">{labels.width}</span>
        )}
        <button
          type="button"
          aria-label={labels.resize}
          title={labels.resize}
          onPointerDown={onPointerDown}
          onKeyDown={onResizeKey}
          className="text-muted-foreground hover:bg-surface-2 hidden size-11 cursor-ew-resize touch-none items-center justify-center rounded-md md:inline-flex"
        >
          <MoveHorizontalIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Settings for the selected widget (brief §7: type, indicators, area, comparison, years,
 * breakdowns, title per language). */
function WidgetSettings({
  widget,
  picker,
  locales,
  defaultLocale,
  fieldId,
  errorText,
  describedBy,
  onChange,
  onType,
  onSpan,
  onRemove,
  preview,
}: {
  widget: AdminWidget;
  picker: PickerData;
  locales: string[];
  defaultLocale: string;
  fieldId: (field: string) => string;
  errorText: (field: string) => string | undefined;
  describedBy: (target: string, error: boolean, hint?: string) => string | undefined;
  onChange: (change: Partial<AdminWidget>) => void;
  onType: (type: Widget["type"]) => void;
  onSpan: (span: number) => void;
  onRemove: () => void;
  preview: React.ReactNode;
}) {
  const t = useTranslations("Admin.dashboards");
  const languageName = useLanguageName();
  const max = WIDGET_MAX_INDICATORS[widget.type] ?? 1;
  const names = new Map(picker.indicators.map((item) => [item.code, item]));
  const first = names.get(widget.indicators[0] ?? "");
  const breakdown = Object.keys(widget.dims ?? {})[0] ?? "";
  const dimLabel = (dim: string) =>
    t.has(`dimension.${dim}`) ? t(`dimension.${dim}` as "dimension.sex") : dim;
  const text = (field: string) => {
    const error = errorText(field);
    return {
      id: fieldId(field),
      "aria-invalid": Boolean(error),
      "aria-describedby": describedBy(fieldId(field), Boolean(error)),
      error,
    };
  };

  return (
    <div className="mt-2 flex flex-col gap-4">
      <div>
        <label htmlFor={fieldId("type")} className="mb-1 block font-semibold">
          {t("field.type")}
        </label>
        <select
          id={fieldId("type")}
          className={FIELD}
          value={widget.type}
          onChange={(event) => onType(event.target.value as Widget["type"])}
        >
          {WIDGET_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`type.${type}`)}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="font-semibold">{t("field.title")}</legend>
        <div className="mt-1 flex flex-col gap-2">
          {locales.map((code) => {
            const field = text(`title.${code}`);
            return (
              <div key={code}>
                <label htmlFor={field.id} className="mb-1 block text-sm">
                  {languageName(code)}
                  {code === defaultLocale && ` ${t("requiredSuffix")}`}
                </label>
                <input
                  id={field.id}
                  lang={code}
                  className={FIELD}
                  value={widget.title[code] ?? ""}
                  aria-invalid={field["aria-invalid"]}
                  aria-describedby={field["aria-describedby"]}
                  onChange={(event) =>
                    onChange({ title: { ...widget.title, [code]: event.target.value } })
                  }
                />
                <FieldMessage id={`${field.id}-error`} text={field.error} />
              </div>
            );
          })}
        </div>
      </fieldset>

      {widget.type === "text" ? (
        <fieldset>
          <legend className="font-semibold">{t("field.body")}</legend>
          <p className="text-muted-foreground text-sm">{t("hint.body")}</p>
          <div className="mt-1 flex flex-col gap-2">
            {locales.map((code) => {
              const field = text(`body.${code}`);
              return (
                <div key={code}>
                  <label htmlFor={field.id} className="mb-1 block text-sm">
                    {languageName(code)}
                    {code === defaultLocale && ` ${t("requiredSuffix")}`}
                  </label>
                  <textarea
                    id={field.id}
                    lang={code}
                    className={AREA}
                    value={widget.body?.[code] ?? ""}
                    aria-invalid={field["aria-invalid"]}
                    aria-describedby={field["aria-describedby"]}
                    onChange={(event) =>
                      onChange({ body: { ...widget.body, [code]: event.target.value } })
                    }
                  />
                  <FieldMessage id={`${field.id}-error`} text={field.error} />
                </div>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <>
          <IndicatorPicker
            id={fieldId("indicators")}
            label={max === 1 ? t("field.indicator") : t("field.indicators")}
            indicators={picker.indicators}
            value={widget.indicators}
            max={max}
            error={errorText("indicators")}
            onChange={(indicators) =>
              onChange({
                indicators,
                ...(indicators[0] !== widget.indicators[0] ? { dims: undefined } : {}),
              })
            }
          />

          {WIDGET_BREAKDOWN.includes(widget.type) && (
            <div>
              <label htmlFor={fieldId("dims")} className="mb-1 block font-semibold">
                {t("field.breakdown")}
              </label>
              <select
                id={fieldId("dims")}
                className={FIELD}
                value={breakdown}
                onChange={(event) =>
                  onChange({ dims: event.target.value ? { [event.target.value]: "*" } : undefined })
                }
              >
                <option value="">{t("noBreakdown")}</option>
                {(first?.disaggregations ?? []).map((dim) => (
                  <option key={dim} value={dim}>
                    {dimLabel(dim)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor={fieldId("area")} className="mb-1 block font-semibold">
              {t("field.area")}
            </label>
            <select
              id={fieldId("area")}
              className={FIELD}
              value={widget.area ?? ""}
              aria-invalid={Boolean(errorText("area"))}
              aria-describedby={describedBy(fieldId("area"), Boolean(errorText("area")))}
              onChange={(event) => onChange({ area: event.target.value || undefined })}
            >
              <option value="">{t("selectorArea")}</option>
              {picker.areas.map((area) => (
                <option key={area.code} value={area.code}>
                  {area.name}
                </option>
              ))}
            </select>
            <FieldMessage id={`${fieldId("area")}-error`} text={errorText("area")} />
          </div>

          {widget.type === "line" && (
            <div>
              <label htmlFor={fieldId("compare")} className="mb-1 block font-semibold">
                {t("field.compare")}
              </label>
              <select
                id={fieldId("compare")}
                className={FIELD}
                value={widget.compare ?? ""}
                onChange={(event) => onChange({ compare: event.target.value || undefined })}
              >
                <option value="">{t("selectorCompare")}</option>
                <optgroup label={t("peerGroups")}>
                  {picker.peers.map((peer) => (
                    <option key={peer.code} value={peer.code}>
                      {peer.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t("areas")}>
                  {picker.areas.map((area) => (
                    <option key={area.code} value={area.code}>
                      {area.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          <div>
            <label htmlFor={fieldId("years")} className="mb-1 block font-semibold">
              {t("field.years")}
            </label>
            <input
              id={fieldId("years")}
              className={`${FIELD} max-w-48 font-mono`}
              value={widget.years ?? ""}
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={Boolean(errorText("years"))}
              aria-describedby={describedBy(
                fieldId("years"),
                Boolean(errorText("years")),
                `${fieldId("years")}-hint`,
              )}
              onChange={(event) => onChange({ years: event.target.value.trim() || undefined })}
            />
            <p id={`${fieldId("years")}-hint`} className="text-muted-foreground mt-1 text-sm">
              {t("hint.years")}
            </p>
            <FieldMessage id={`${fieldId("years")}-error`} text={errorText("years")} />
          </div>
        </>
      )}

      <fieldset>
        <legend className="font-semibold">{t("field.span")}</legend>
        <div className="mt-1 flex gap-2">
          {[1, 2, 3].map((span) => (
            <label
              key={span}
              className={cn(
                "flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-3",
                widget.span === span && "border-primary border-2 font-semibold",
              )}
            >
              <input
                type="radio"
                name={fieldId("span")}
                className="size-4"
                checked={widget.span === span}
                onChange={() => onSpan(span)}
              />
              {t("spanValue", { span })}
            </label>
          ))}
        </div>
      </fieldset>

      {preview}

      <div>
        <Button variant="danger" onClick={onRemove}>
          {t("removeWidget")}
        </Button>
      </div>
    </div>
  );
}
