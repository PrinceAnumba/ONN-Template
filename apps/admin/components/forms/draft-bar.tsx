"use client";

import type { ContentStatus } from "@onn/api-client/types";
import { StatusPill } from "@onn/ui/components/status-pill";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { ExternalLinkIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { bff } from "@/lib/bff";
import { CONTENT_TONE } from "@/lib/content";
import { useUnsavedWarning } from "@/lib/use-unsaved";

/**
 * Save-as-draft and publish for content the portal shows (CMS pages, home modules): a draft
 * stays private, and Publish saves any open changes first so it never publishes stale text.
 */
export function useDraftPublish<T extends { status: ContentStatus }>({
  path,
  initial,
  body,
  onSaved,
  onError,
}: {
  /** The resource under the BFF, e.g. `/pages/about`. */
  path: string;
  initial: T;
  body: () => unknown;
  onSaved: (saved: T) => void;
  /** Returns true when it showed the error itself (field errors). */
  onError: (error: unknown) => boolean;
}) {
  const t = useTranslations("Admin.forms");
  const [status, setStatus] = useState(initial.status);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  useUnsavedWarning(dirty);

  const run = async (publish: boolean) => {
    setBusy(publish ? "publish" : "save");
    try {
      let saved: T | undefined;
      if (dirty || !publish) saved = await bff<T>(path, { method: "PUT", body: body() });
      if (publish) saved = await bff<T>(`${path}/publish`, { method: "POST" });
      if (saved) {
        setStatus(saved.status);
        onSaved(saved);
      }
      setDirty(false);
      showToast(t(publish ? "publishedToast" : "draftSaved"));
    } catch (error) {
      if (!onError(error)) showToast(t("saveFailed"), "error");
    } finally {
      setBusy(null);
    }
  };
  return { status, dirty, busy, touch: () => setDirty(true), run };
}

/** Status, "View on the portal", Save draft and Publish, with a line saying what's pending. */
export function DraftBar({
  draft,
  portalHref,
}: {
  draft: Pick<ReturnType<typeof useDraftPublish>, "status" | "dirty" | "busy" | "run">;
  portalHref: string;
}) {
  const t = useTranslations("Admin.forms");
  const { status, dirty, busy, run } = draft;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <StatusPill tone={CONTENT_TONE[status]} label={t(`status.${status}`)} />
        <a
          href={portalHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-md px-3 underline"
        >
          {t("viewOnPortal")}
          <ExternalLinkIcon aria-hidden="true" className="size-4" />
          <span className="sr-only">{t("newWindow")}</span>
        </a>
        <Button variant="secondary" disabled={busy !== null || !dirty} onClick={() => run(false)}>
          {busy === "save" && (
            <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
          )}
          {t("saveDraft")}
        </Button>
        <Button
          disabled={busy !== null || (status === "published" && !dirty)}
          onClick={() => run(true)}
        >
          {busy === "publish" && (
            <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
          )}
          {t("publish")}
        </Button>
      </div>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {dirty ? t("unsaved") : status === "changed" ? t("changedNotice") : ""}
      </p>
    </div>
  );
}
