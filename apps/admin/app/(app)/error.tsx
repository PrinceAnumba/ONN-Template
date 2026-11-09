"use client";

import { Button } from "@onn/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";

/** A failed screen keeps the shell; "Try again" refetches the data and resets. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Admin.error");
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="max-w-xl">
      <h1 ref={heading} tabIndex={-1} className="text-h1">
        {t("title")}
      </h1>
      <p className="text-muted-foreground mt-2">{t("body")}</p>
      {error.digest && (
        <p className="text-muted-foreground mt-2 text-sm">{t("reference", { id: error.digest })}</p>
      )}
      <Button
        className="mt-6"
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        {t("retry")}
      </Button>
    </div>
  );
}
