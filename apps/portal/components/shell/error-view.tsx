"use client";

import { Button } from "@onn/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useTransition } from "react";
import { Link, usePathname } from "@/i18n/navigation";

export interface ErrorViewProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Route-level error (brief §8): a plain message, "Try again" and "Report a problem", which opens
 * feedback with the error id. Server errors carry Next's digest, which matches the server log;
 * client errors get a random id logged to the console.
 */
export function ErrorView({ error, reset }: ErrorViewProps) {
  const t = useTranslations("Errors");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const id = useMemo(() => error.digest ?? `c-${Math.random().toString(36).slice(2, 10)}`, [error]);

  useEffect(() => {
    console.error(`[${id}]`, error);
  }, [error, id]);

  // reset() alone re-renders the client tree; a Server Component error also needs new RSC data.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <main id="content" className="onn-container py-16">
      <h1>{t("title")}</h1>
      <p className="mt-3 max-w-prose">{t("body")}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={retry} loading={pending}>
          {t("retry")}
        </Button>
        <Button asChild variant="secondary">
          <Link href={{ pathname: "/feedback", query: { page: pathname, error: id } }}>
            {t("report")}
          </Link>
        </Button>
      </div>
      <p className="text-muted-foreground mt-6 text-sm">
        {t("reference")}
        <code className="bg-surface-2 ms-1 rounded px-1">{id}</code>
      </p>
    </main>
  );
}
