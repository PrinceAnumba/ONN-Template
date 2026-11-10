"use client";

import type { MediaUpload } from "@onn/api-client/types";
import { FileDrop } from "@onn/ui/components/file-drop";
import { Button } from "@onn/ui/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { BffError, uploadForm } from "@/lib/bff";
import { formatBytes } from "@/lib/format";
import { errorCode } from "./form-errors";

export const IMAGE_MAX = 2 * 1024 * 1024;
export const IMAGE_TYPES = [".png", ".jpg", ".jpeg", ".webp"];

/**
 * One picture: uploads as soon as a file is chosen (`POST /admin/media`) and hands back its
 * public address, which the form saves with the rest. `id` is the error summary's focus target.
 */
export function ImageField({
  id,
  label,
  value,
  onChange,
  error,
  optional,
}: {
  id: string;
  label: string;
  value?: string;
  onChange: (url: string | undefined) => void;
  /** A server error for this field, already translated. */
  error?: string;
  optional?: boolean;
}) {
  const t = useTranslations("Admin.media");
  const forms = useTranslations("Admin.forms");
  const locale = useLocale();
  const [progress, setProgress] = useState<number>();
  const [problem, setProblem] = useState<string>();
  const size = formatBytes(IMAGE_MAX, locale);

  const upload = async (file: File) => {
    const form = new FormData();
    form.set("image", file);
    setProblem(undefined);
    setProgress(0);
    try {
      const uploaded = await uploadForm<MediaUpload>("/media", form, setProgress);
      onChange(uploaded.url);
    } catch (failure) {
      const code = failure instanceof BffError ? failure.errors[0]?.message : undefined;
      setProblem(code ? forms(`error.${errorCode(code)}`) : t("failed"));
    } finally {
      setProgress(undefined);
    }
  };

  return (
    <div>
      <span className="mb-1 block font-semibold" id={`${id}-label`}>
        {label}
        {optional && (
          <span className="text-muted-foreground ms-1 text-sm font-normal">
            {forms("optional")}
          </span>
        )}
      </span>
      <div role="group" id={id} tabIndex={-1} aria-labelledby={`${id}-label`}>
        {value ? (
          <div className="flex flex-wrap items-end gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- served by the API */}
            <img
              src={value}
              alt={t("preview")}
              className="bg-surface-2 max-h-40 max-w-full rounded-md border object-contain"
            />
            <Button type="button" variant="secondary" onClick={() => onChange(undefined)}>
              {t("remove")}
            </Button>
          </div>
        ) : (
          <FileDrop
            accept={IMAGE_TYPES}
            maxBytes={IMAGE_MAX}
            onFile={upload}
            onReject={(reason) =>
              setProblem(reason === "type" ? forms("error.type") : t("tooLarge", { size }))
            }
            error={problem ?? error}
            progress={progress}
            disabled={progress !== undefined}
            labels={{
              prompt: t("prompt"),
              browse: t("browse"),
              hint: t("hint", { size }),
              remove: t("remove"),
              progress: t("progress"),
            }}
          />
        )}
      </div>
    </div>
  );
}
