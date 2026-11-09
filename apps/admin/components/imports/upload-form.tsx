"use client";

import type { ImportJob } from "@onn/api-client/types";
import { FileDrop } from "@onn/ui/components/file-drop";
import { Button } from "@onn/ui/components/ui/button";
import { DownloadIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { BFF, BffError, uploadForm } from "@/lib/bff";
import { formatBytes } from "@/lib/format";
import { IMPORT_ACCEPT, IMPORT_MAX_BYTES } from "@/lib/imports";

/** Step 1: organisation, template and file. The upload goes through the proxy with progress. */
export function UploadForm({
  orgs,
  defaultOrg,
  demo,
}: {
  orgs: { code: string; name: string }[];
  defaultOrg: string;
  /** Mocks are on: offer the demo file with seeded errors. */
  demo: boolean;
}) {
  const t = useTranslations("Admin.imports.upload");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [org, setOrg] = useState(defaultOrg);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const [orgError, setOrgError] = useState(false);
  const [progress, setProgress] = useState<number>();

  const submit = async () => {
    setOrgError(!org);
    if (!org) {
      document.getElementById(`${id}-org`)?.focus();
      return;
    }
    if (!file) {
      setError(t("noFile"));
      return;
    }
    const form = new FormData();
    form.set("org", org);
    form.set("file", file);
    setProgress(0);
    try {
      const job = await uploadForm<ImportJob>("/imports", form, setProgress);
      router.push(`/imports/${job.id}`);
    } catch (caught) {
      setProgress(undefined);
      const type = caught instanceof BffError ? caught.type : "network";
      setError(t.has(`failed.${type}`) ? t(`failed.${type}`) : t("failed.other"));
    }
  };

  const uploading = progress !== undefined;
  return (
    <form
      className="mt-8 grid max-w-3xl gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      noValidate
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-org`} className="font-semibold">
          {t("org")}
        </label>
        <select
          id={`${id}-org`}
          value={org}
          onChange={(event) => {
            setOrg(event.target.value);
            setOrgError(false);
          }}
          disabled={uploading}
          aria-invalid={orgError || undefined}
          aria-describedby={orgError ? `${id}-org-error` : undefined}
          className="border-input bg-background h-11 max-w-md rounded-md border px-3"
        >
          {orgs.length > 1 && <option value="">{t("chooseOrg")}</option>}
          {orgs.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
        {orgError && (
          <p id={`${id}-org-error`} className="text-destructive text-sm">
            {t("orgRequired")}
          </p>
        )}
      </div>

      {org && (
        <div className="bg-surface-2 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg p-4">
          <p className="w-full text-sm">{t("templateIntro")}</p>
          <a
            href={`${BFF}/imports/template?org=${encodeURIComponent(org)}`}
            download
            className="inline-flex min-h-11 items-center gap-2 font-semibold underline"
          >
            <DownloadIcon aria-hidden className="size-4" />
            {t("template")}
          </a>
          {demo && (
            <a
              href={`${BFF}/imports/template?org=${encodeURIComponent(org)}&demo=errors`}
              download
              className="inline-flex min-h-11 items-center gap-2 underline"
            >
              <DownloadIcon aria-hidden className="size-4" />
              {t("demoFile")}
            </a>
          )}
        </div>
      )}

      <FileDrop
        accept={IMPORT_ACCEPT}
        maxBytes={IMPORT_MAX_BYTES}
        file={file}
        fileLabel={
          file
            ? t("fileLabel", { name: file.name, size: formatBytes(file.size, locale) })
            : undefined
        }
        onFile={(picked) => {
          setFile(picked);
          setError(undefined);
        }}
        onReject={(reason) => setError(t(reason === "type" ? "wrongType" : "tooLarge"))}
        onClear={() => setFile(null)}
        error={error}
        progress={progress}
        disabled={uploading}
        labels={{ prompt: t("prompt"), browse: t("browse"), hint: t("hint"), remove: t("remove"), progress: t("progress") }}
      />

      <div>
        <Button type="submit" disabled={uploading}>
          {uploading ? t("uploading") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
