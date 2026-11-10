"use client";

import type { RichTextEditorProps } from "@onn/ui/components/rich-text-editor";
import { Skeleton } from "@onn/ui/components/skeleton";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

/** Tiptap is large, so it loads after the page; the skeleton keeps its height. */
const Editor = dynamic(
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

/** The rich text editor with its toolbar labels translated. */
export function RichText(props: Omit<RichTextEditorProps, "labels">) {
  const t = useTranslations("Admin.richText");
  return (
    <Editor
      {...props}
      labels={{
        toolbar: t("toolbar"),
        bold: t("bold"),
        italic: t("italic"),
        heading2: t("heading2"),
        heading3: t("heading3"),
        bulletList: t("bulletList"),
        orderedList: t("orderedList"),
        quote: t("quote"),
        undo: t("undo"),
        redo: t("redo"),
      }}
    />
  );
}
