"use client";

import type { PublicationAdmin } from "@onn/api-client/types";
import { FileDrop } from "@onn/ui/components/file-drop";
import { StatusPill } from "@onn/ui/components/status-pill";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { ExternalLinkIcon, LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { BFF, bff, BffError, uploadForm } from "@/lib/bff";
import { portalUrl, SIGNATURE_TONE } from "@/lib/content";
import { formatBytes, formatDate, formatTime } from "@/lib/format";
import { COVER_MAX, COVER_TYPES, PDF_MAX, PublicationForm } from "./publication-form";

const POLL_MS = 2000;

interface PublicationDetailProps {
  initial: PublicationAdmin;
  pillars: { code: string; name: string }[];
  locales: string[];
  defaultLocale: string;
}

/**
 * One publication: the backend signs each uploaded PDF, so the page polls while the signature is
 * pending and publishing waits for it (brief §7). A live file can't be replaced.
 */
export function PublicationDetail({
  initial,
  pillars,
  locales,
  defaultLocale,
}: PublicationDetailProps) {
  const t = useTranslations("Admin.publications");
  const locale = useLocale();
  const id = useId();
  const [item, setItem] = useState(initial);
  const [busy, setBusy] = useState<"publish" | "unpublish" | "upload" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [progress, setProgress] = useState<number>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (item.signature !== "pending") return;
    const timer = setInterval(async () => {
      const next = await bff<PublicationAdmin>(`/publications/${item.slug}`).catch(() => null);
      if (next && next.signature !== "pending") {
        setItem(next);
        if (next.signature === "signed") showToast(t("signedToast"));
        else showToast(t("signFailedToast"), "error");
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [item.signature, item.slug, t]);

  const title = item.title[locale] || item.title[defaultLocale] || item.slug;
  const act = async (action: "publish" | "unpublish") => {
    setBusy(action);
    try {
      setItem(
        await bff<PublicationAdmin>(`/publications/${item.slug}/${action}`, { method: "POST" }),
      );
      showToast(t(action === "publish" ? "publishedToast" : "unpublishedToast"));
    } catch (error) {
      showToast(
        error instanceof BffError && error.type === "unsigned"
          ? t("unsignedReason")
          : t("saveFailed"),
        "error",
      );
    } finally {
      setBusy(null);
    }
  };
  const replace = async () => {
    if (!file && !cover) {
      setFileError(t("error.required"));
      return;
    }
    const form = new FormData();
    if (file) form.set("file", file);
    if (cover) form.set("cover", cover);
    setBusy("upload");
    setProgress(0);
    try {
      setItem(
        await uploadForm<PublicationAdmin>(`/publications/${item.slug}/files`, form, setProgress),
      );
      setFile(null);
      setCover(null);
      setFileError(undefined);
      setVersion((value) => value + 1);
      showToast(file ? t("replacedToast") : t("coverToast"));
    } catch (error) {
      setFileError(
        error instanceof BffError && error.errors[0]
          ? t(
              `error.${["type", "size", "empty"].includes(error.errors[0].message) ? (error.errors[0].message as "type") : "invalid"}`,
            )
          : t("saveFailed"),
      );
    } finally {
      setBusy(null);
      setProgress(undefined);
    }
  };
  const fileLabel = (picked: File | null) =>
    picked
      ? t("fileLabel", { name: picked.name, size: formatBytes(picked.size, locale) })
      : undefined;
  const dropLabels = (hint: string) => ({
    prompt: t("drop.prompt"),
    browse: t("drop.browse"),
    hint,
    remove: t("drop.remove"),
    progress: t("drop.progress"),
  });
  const signed = item.signature === "signed";

  return (
    <div className="mt-2 flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 break-words">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill
              tone={SIGNATURE_TONE[item.signature]}
              label={t(`signature.${item.signature}`)}
            />
            <StatusPill
              tone={item.published ? "positive" : "neutral"}
              label={item.published ? t("published") : t("notPublished")}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.published ? (
            <>
              <a
                href={portalUrl(`/${locale}/publications/${item.slug}`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-md px-3 underline"
              >
                {t("viewOnPortal")}
                <ExternalLinkIcon aria-hidden="true" className="size-4" />
                <span className="sr-only">{t("newWindow")}</span>
              </a>
              <Button variant="secondary" onClick={() => act("unpublish")} disabled={busy !== null}>
                {busy === "unpublish" && (
                  <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
                )}
                {t("unpublish")}
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={() => signed && act("publish")}
                aria-disabled={!signed || undefined}
                aria-describedby={signed ? undefined : `${id}-publish-reason`}
                disabled={busy !== null}
                className={signed ? undefined : "cursor-not-allowed opacity-60"}
              >
                {busy === "publish" && (
                  <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
                )}
                {t("publish")}
              </Button>
              {!signed && (
                <p
                  id={`${id}-publish-reason`}
                  className="text-muted-foreground max-w-64 text-end text-sm"
                >
                  {item.signature === "pending" ? t("unsignedReason") : t("failedReason")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <section
        aria-labelledby={`${id}-file`}
        className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- served by the API through the BFF */}
        <img
          key={version}
          src={`${BFF}/publications/${item.slug}/cover?v=${version}`}
          alt={t("coverAlt", { title })}
          width={192}
          height={256}
          className="bg-surface-2 aspect-3/4 w-48 rounded-md border object-cover"
        />
        <div className="flex min-w-0 flex-col gap-3">
          <h2 id={`${id}-file`} className="text-h3">
            {t("fileTitle")}
          </h2>
          <p className="break-all">
            <a
              href={`${BFF}/publications/${item.slug}/file`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {item.fileName}
            </a>{" "}
            <span className="text-muted-foreground">
              {t("fileSize", { size: formatBytes(item.fileBytes, locale) })}
            </span>
          </p>
          <p aria-live="polite" className="flex items-center gap-2">
            {item.signature === "pending" && (
              <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
            )}
            {item.signature === "signed" && item.signedAt
              ? t("signedAt", {
                  date: formatDate(item.signedAt, locale, "medium"),
                  time: formatTime(item.signedAt, locale),
                })
              : t(`signatureHelp.${item.signature}`)}
          </p>
          {item.published ? (
            <p className="text-muted-foreground text-sm">{t("replaceBlocked")}</p>
          ) : (
            <details className="rounded-lg border">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">
                {t("replaceTitle")}
              </summary>
              <div className="flex flex-col gap-4 border-t p-4">
                <p className="text-muted-foreground text-sm">{t("replaceHelp")}</p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FileDrop
                    accept={[".pdf"]}
                    maxBytes={PDF_MAX}
                    file={file}
                    fileLabel={fileLabel(file)}
                    onFile={(picked) => {
                      setFile(picked);
                      setFileError(undefined);
                    }}
                    onReject={(reason) =>
                      setFileError(
                        reason === "type"
                          ? t("error.type")
                          : t("error.sizeMax", { size: formatBytes(PDF_MAX, locale) }),
                      )
                    }
                    onClear={() => setFile(null)}
                    error={fileError}
                    progress={busy === "upload" ? progress : undefined}
                    disabled={busy !== null}
                    labels={dropLabels(t("hint.file", { size: formatBytes(PDF_MAX, locale) }))}
                  />
                  <FileDrop
                    accept={COVER_TYPES}
                    maxBytes={COVER_MAX}
                    file={cover}
                    fileLabel={fileLabel(cover)}
                    onFile={setCover}
                    onReject={(reason) =>
                      setFileError(
                        reason === "type"
                          ? t("error.type")
                          : t("error.sizeMax", { size: formatBytes(COVER_MAX, locale) }),
                      )
                    }
                    onClear={() => setCover(null)}
                    disabled={busy !== null}
                    labels={dropLabels(t("hint.cover", { size: formatBytes(COVER_MAX, locale) }))}
                  />
                </div>
                <div>
                  <Button variant="secondary" onClick={replace} disabled={busy !== null}>
                    {busy === "upload" && (
                      <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
                    )}
                    {t("replace")}
                  </Button>
                </div>
              </div>
            </details>
          )}
        </div>
      </section>

      <section aria-labelledby={`${id}-meta`}>
        <h2 id={`${id}-meta`} className="text-h3 mb-4">
          {t("metaTitle")}
        </h2>
        <PublicationForm
          mode={{ kind: "edit", slug: item.slug, onSaved: setItem }}
          initial={{
            title: item.title,
            summary: item.summary,
            type: item.type,
            period: item.period,
            date: item.date,
            pillar: item.pillar,
          }}
          pillars={pillars}
          locales={locales}
          defaultLocale={defaultLocale}
        />
      </section>
    </div>
  );
}
