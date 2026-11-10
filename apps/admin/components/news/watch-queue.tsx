"use client";

import type { WatchItem } from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { bff } from "@/lib/bff";
import { formatDate, formatTime } from "@/lib/format";
import { useLanguageName } from "@/lib/languages";

type Action = "approve" | "reject" | "restore" | "draft";

/**
 * Stories the collector found (brief §7 *Watch queue*). Approve publishes one as a watch item,
 * Edit opens it as a draft article first, Reject sets it aside (and can be undone).
 */
export function WatchQueue({ items }: { items: WatchItem[] }) {
  const t = useTranslations("Admin.news.watch");
  const forms = useTranslations("Admin.forms");
  const locale = useLocale();
  const router = useRouter();
  const languageName = useLanguageName();
  const list = useRef<HTMLUListElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (item: WatchItem, action: Action) => {
    setBusy(`${item.id}:${action}`);
    try {
      const next = await bff<WatchItem>(`/news-watch/${item.id}/${action}`, { method: "POST" });
      if (action === "draft" && next.article) {
        router.push(`/news/${next.article}`);
        return;
      }
      showToast(t(`done.${action as "approve"}`));
      // The item leaves this list, so its buttons go with it.
      list.current?.focus();
      router.refresh();
    } catch {
      showToast(forms("saveFailed"), "error");
    } finally {
      setBusy(null);
    }
  };
  const button = (item: WatchItem, action: Action, variant: "primary" | "secondary") => (
    <Button
      variant={variant}
      disabled={busy !== null}
      aria-describedby={`watch-${item.id}`}
      onClick={() => act(item, action)}
    >
      {busy === `${item.id}:${action}` && (
        <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
      )}
      {t(`action.${action}`)}
    </Button>
  );

  return (
    <ul ref={list} tabIndex={-1} aria-label={t("listLabel")} className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border p-4">
          <h3 id={`watch-${item.id}`} lang={item.lang} className="text-h4">
            {item.title}
          </h3>
          <p lang={item.lang} className="mt-1">
            {item.excerpt}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("meta", {
              source: item.source,
              language: languageName(item.lang),
              date: formatDate(item.found, locale, "medium"),
              time: formatTime(item.found, locale),
            })}{" "}
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="underline">
              {t("openSource")}
              <span className="sr-only">{forms("newWindow")}</span>
            </a>
          </p>
          <p className="mt-1 text-sm">{t("matched", { keywords: item.keywords.join(", ") })}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {item.status === "pending" && (
              <>
                {button(item, "approve", "primary")}
                {button(item, "draft", "secondary")}
                {button(item, "reject", "secondary")}
              </>
            )}
            {item.status === "rejected" && button(item, "restore", "secondary")}
            {item.status === "approved" && item.article && (
              <Link
                href={`/news/${item.article}`}
                className="inline-flex min-h-11 items-center underline"
              >
                {t("openArticle")}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
