"use client";

import type { ReportAdmin, ReportComment } from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { Skeleton } from "@onn/ui/components/skeleton";
import { cn } from "@onn/ui/lib/utils";
import { LoaderCircleIcon, MessageSquareIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useId, useState } from "react";
import { FIELD, FieldMessage } from "@/components/forms/form-errors";
import { bff } from "@/lib/bff";
import { formatDate, formatTime } from "@/lib/format";

/** Tiptap is large, so it loads with the first text block; the skeleton keeps its height. */
const RichTextEditor = dynamic(
  () => import("@onn/ui/components/rich-text-editor").then((module) => module.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-1" aria-hidden="true">
        <Skeleton className="h-5 w-16" />
        <div className="rounded-md border">
          <div className="h-13 border-b" />
          <div className="flex min-h-40 flex-col gap-2 px-3 py-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    ),
  },
);

const AREA = "border-input bg-background min-h-20 w-full rounded-md border px-3 py-2";

/** A text block: rich text, an assignee and a comment thread (brief §7). */
export function TextBlock({
  reportId,
  blockId,
  html,
  assignee,
  comments,
  people,
  saved,
  fieldId,
  errorText,
  onChange,
  onComments,
}: {
  reportId: string;
  blockId: string;
  html: string;
  assignee?: string;
  comments: ReportComment[];
  people: ReportAdmin["people"];
  /** Comments need the block to exist on the server. */
  saved: boolean;
  fieldId: (field: string) => string;
  errorText: (field: string) => string | undefined;
  onChange: (change: { html?: string; assignee?: string }) => void;
  onComments: (comments: ReportComment[]) => void;
}) {
  const t = useTranslations("Admin.reports");
  const editor = useTranslations("Admin.richText");
  const locale = useLocale();
  const id = useId();
  const [text, setText] = useState("");
  const [textError, setTextError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const open = comments.filter((comment) => !comment.resolved);
  const shown = showResolved ? comments : open;

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      setTextError(true);
      return;
    }
    setBusy("add");
    try {
      const comment = await bff<ReportComment>(`/reports/${reportId}/blocks/${blockId}/comments`, {
        method: "POST",
        body: { text },
      });
      onComments([...comments, comment]);
      setText("");
    } catch {
      showToast(t("commentFailed"), "error");
    } finally {
      setBusy(null);
    }
  };
  const toggle = async (comment: ReportComment) => {
    setBusy(comment.id);
    try {
      const next = await bff<ReportComment>(
        `/reports/${reportId}/blocks/${blockId}/comments/${comment.id}`,
        { method: "PATCH", body: { resolved: !comment.resolved } },
      );
      onComments(comments.map((item) => (item.id === next.id ? next : item)));
    } catch {
      showToast(t("commentFailed"), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <RichTextEditor
          label={t("field.text")}
          value={html}
          onChange={(next) => onChange({ html: next })}
          labels={{
            toolbar: editor("toolbar"),
            bold: editor("bold"),
            italic: editor("italic"),
            heading2: editor("heading2"),
            heading3: editor("heading3"),
            bulletList: editor("bulletList"),
            orderedList: editor("orderedList"),
            quote: editor("quote"),
            undo: editor("undo"),
            redo: editor("redo"),
          }}
        />
        <div className="max-w-xs">
          <label htmlFor={fieldId("assignee")} className="mb-1 block font-semibold">
            {t("field.assignee")}
          </label>
          <select
            id={fieldId("assignee")}
            className={FIELD}
            value={assignee ?? ""}
            aria-invalid={Boolean(errorText("assignee"))}
            onChange={(event) => onChange({ assignee: event.target.value || undefined })}
          >
            <option value="">{t("unassigned")}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <FieldMessage id={`${fieldId("assignee")}-error`} text={errorText("assignee")} />
        </div>
      </div>

      <div role="group" aria-labelledby={`${id}-comments`} className="bg-surface-2 rounded-lg p-3">
        {/* Not a heading: the text above may hold any heading level. */}
        <p id={`${id}-comments`} className="flex items-center gap-2 font-semibold">
          <MessageSquareIcon aria-hidden="true" className="size-4" />
          {t("comments", { count: open.length })}
        </p>
        {comments.length > open.length && (
          <button
            type="button"
            className="mt-1 min-h-11 text-sm underline"
            aria-pressed={showResolved}
            onClick={() => setShowResolved(!showResolved)}
          >
            {t("showResolved", { count: comments.length - open.length })}
          </button>
        )}
        {shown.length > 0 && (
          <ol className="mt-2 flex flex-col gap-2">
            {shown.map((comment) => (
              <li
                key={comment.id}
                className={cn(
                  "bg-background rounded-md border p-2 text-sm",
                  comment.resolved && "opacity-75",
                )}
              >
                <p className="font-semibold">{comment.author.name}</p>
                <p className="text-muted-foreground text-xs">
                  {t("commentDate", {
                    date: formatDate(comment.date, locale, "medium"),
                    time: formatTime(comment.date, locale),
                  })}
                  {comment.resolved && ` · ${t("resolved")}`}
                </p>
                <p className="mt-1 whitespace-pre-line">{comment.text}</p>
                <button
                  type="button"
                  className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm underline"
                  disabled={busy !== null}
                  onClick={() => toggle(comment)}
                >
                  {busy === comment.id && (
                    <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
                  )}
                  {comment.resolved ? t("reopen") : t("resolve")}
                </button>
              </li>
            ))}
          </ol>
        )}
        {saved ? (
          <form onSubmit={add} noValidate className="mt-3 flex flex-col gap-2">
            <label htmlFor={`${id}-new`} className="text-sm font-semibold">
              {t("newComment")}
            </label>
            <textarea
              id={`${id}-new`}
              className={AREA}
              value={text}
              maxLength={2000}
              aria-invalid={textError}
              aria-describedby={textError ? `${id}-new-error` : undefined}
              onChange={(event) => {
                setText(event.target.value);
                if (event.target.value.trim()) setTextError(false);
              }}
            />
            <FieldMessage id={`${id}-new-error`} text={textError && t("commentRequired")} />
            <div>
              <Button type="submit" variant="secondary" disabled={busy !== null}>
                {busy === "add" && (
                  <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
                )}
                {t("addComment")}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">{t("saveToComment")}</p>
        )}
      </div>
    </div>
  );
}
