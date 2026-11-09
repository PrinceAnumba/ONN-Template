"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  Redo2Icon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../lib/utils";
import { Skeleton } from "./skeleton";

export interface RichTextEditorLabels {
  /** Accessible name of the formatting toolbar. */
  toolbar: string;
  bold: string;
  italic: string;
  heading2: string;
  heading3: string;
  bulletList: string;
  orderedList: string;
  quote: string;
  undo: string;
  redo: string;
}

export interface RichTextEditorProps {
  /** Visible label above the editor (it labels the text box). */
  label: string;
  /** HTML; an empty document is "". */
  value: string;
  onChange: (html: string) => void;
  labels: RichTextEditorLabels;
  /** Hint under the label, linked with aria-describedby. */
  hint?: string;
  /** Error under the editor, linked with aria-describedby. */
  error?: string;
  disabled?: boolean;
  /** Shows the placeholder (e.g. while the editor's code loads). */
  loading?: boolean;
  className?: string;
}

type Tool = {
  key: keyof RichTextEditorLabels;
  icon: LucideIcon;
  run: (editor: Editor) => void;
  active?: (editor: Editor) => boolean;
  enabled?: (editor: Editor) => boolean;
};

const TOOLS: Tool[] = [
  {
    key: "bold",
    icon: BoldIcon,
    run: (e) => e.chain().focus().toggleBold().run(),
    active: (e) => e.isActive("bold"),
  },
  {
    key: "italic",
    icon: ItalicIcon,
    run: (e) => e.chain().focus().toggleItalic().run(),
    active: (e) => e.isActive("italic"),
  },
  {
    key: "heading2",
    icon: Heading2Icon,
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (e) => e.isActive("heading", { level: 2 }),
  },
  {
    key: "heading3",
    icon: Heading3Icon,
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    active: (e) => e.isActive("heading", { level: 3 }),
  },
  {
    key: "bulletList",
    icon: ListIcon,
    run: (e) => e.chain().focus().toggleBulletList().run(),
    active: (e) => e.isActive("bulletList"),
  },
  {
    key: "orderedList",
    icon: ListOrderedIcon,
    run: (e) => e.chain().focus().toggleOrderedList().run(),
    active: (e) => e.isActive("orderedList"),
  },
  {
    key: "quote",
    icon: QuoteIcon,
    run: (e) => e.chain().focus().toggleBlockquote().run(),
    active: (e) => e.isActive("blockquote"),
  },
  {
    key: "undo",
    icon: Undo2Icon,
    run: (e) => e.chain().focus().undo().run(),
    enabled: (e) => e.can().undo(),
  },
  {
    key: "redo",
    icon: Redo2Icon,
    run: (e) => e.chain().focus().redo().run(),
    enabled: (e) => e.can().redo(),
  },
];

const toHtml = (editor: Editor) => (editor.isEmpty ? "" : editor.getHTML());

/**
 * Rich text (Tiptap) with headings, lists, quotes, bold and italic, for report text and CMS
 * content. The toolbar follows the APG toolbar pattern: one tab stop, arrow keys between buttons,
 * and toggle buttons report `aria-pressed`. Output is HTML; the server sanitises it before use.
 */
export function RichTextEditor({
  label,
  value,
  onChange,
  labels,
  hint,
  error,
  disabled,
  loading,
  className,
}: RichTextEditorProps) {
  const id = useId();
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined;
  const changed = useRef(onChange);
  changed.current = onChange;
  // Re-render the toolbar when the selection or history changes.
  const [, setTick] = useState(0);
  const [focusIndex, setFocusIndex] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => changed.current(toHtml(current)),
    onTransaction: () => setTick((tick) => tick + 1),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": `${id}-label`,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(error ? { "aria-invalid": "true" } : {}),
        class: "onn-prose min-h-40 px-3 py-2 outline-none",
      },
    },
  });

  // Follow outside changes (a reset or a reload) without fighting the user's typing.
  useEffect(() => {
    if (editor && value !== toHtml(editor)) editor.commands.setContent(value, false);
  }, [editor, value]);
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  useEffect(() => {
    if (!editor) return;
    const attributes = editor.view.dom;
    if (describedBy) attributes.setAttribute("aria-describedby", describedBy);
    else attributes.removeAttribute("aria-describedby");
    if (error) attributes.setAttribute("aria-invalid", "true");
    else attributes.removeAttribute("aria-invalid");
  }, [editor, describedBy, error]);

  const onToolbarKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      Home: -Infinity,
      End: Infinity,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const step = keys[event.key]!;
    const delta = Number.isFinite(step) && rtl ? -step : step;
    const next =
      delta === -Infinity
        ? 0
        : delta === Infinity
          ? TOOLS.length - 1
          : (focusIndex + delta + TOOLS.length) % TOOLS.length;
    setFocusIndex(next);
    buttons.current[next]?.focus();
  };

  const ready = editor && !loading;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span id={`${id}-label`} className="font-semibold">
        {label}
      </span>
      {hint && (
        <span id={`${id}-hint`} className="text-muted-foreground text-sm">
          {hint}
        </span>
      )}
      <div
        className={cn(
          "bg-background rounded-md border",
          error && "border-destructive border-2",
          disabled && "bg-surface-2",
        )}
      >
        <div
          role="toolbar"
          aria-label={labels.toolbar}
          onKeyDown={onToolbarKey}
          className="flex flex-wrap gap-0.5 border-b p-1"
        >
          {TOOLS.map((tool, index) => {
            const Icon = tool.icon;
            const pressed = ready && tool.active ? tool.active(editor) : undefined;
            const enabled = Boolean(ready && !disabled && (tool.enabled?.(editor) ?? true));
            return (
              <button
                key={tool.key}
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                type="button"
                tabIndex={index === focusIndex ? 0 : -1}
                aria-label={labels[tool.key]}
                title={labels[tool.key]}
                aria-pressed={tool.active ? Boolean(pressed) : undefined}
                aria-disabled={!enabled || undefined}
                onFocus={() => setFocusIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => enabled && editor && tool.run(editor)}
                className={cn(
                  "text-foreground inline-flex size-11 items-center justify-center rounded-md",
                  enabled ? "hover:bg-surface-2" : "text-muted-foreground cursor-not-allowed",
                  pressed && "bg-surface-2 text-primary",
                  index === 6 && "me-1",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
              </button>
            );
          })}
        </div>
        {ready ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="flex min-h-40 flex-col gap-2 px-3 py-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
      </div>
      {error && (
        <span id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </span>
      )}
    </div>
  );
}
