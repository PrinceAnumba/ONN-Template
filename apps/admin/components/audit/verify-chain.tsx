"use client";

import type { AuditVerification } from "@onn/api-client/types";
import { Button } from "@onn/ui/components/ui/button";
import { CircleAlertIcon, CircleCheckIcon, LoaderCircleIcon, ShieldCheckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { bff } from "@/lib/bff";
import { formatNumber, formatTime } from "@/lib/format";

/** "Verify chain" (brief §7): asks the server to recompute every hash and shows the answer. */
export function VerifyChain() {
  const t = useTranslations("Admin.audit");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AuditVerification | "error" | null>(null);
  const verify = async () => {
    setBusy(true);
    try {
      setResult(await bff<AuditVerification>("/audit/verify", { method: "POST" }));
    } catch {
      setResult("error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button type="button" variant="secondary" disabled={busy} onClick={verify}>
        {busy ? (
          <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <ShieldCheckIcon aria-hidden="true" />
        )}
        {t("verify")}
      </Button>
      <p role="status" className="flex max-w-md items-start gap-2 text-sm">
        {result === "error" && (
          <>
            <CircleAlertIcon
              aria-hidden="true"
              className="text-destructive mt-0.5 size-4 shrink-0"
            />
            {t("verifyFailed")}
          </>
        )}
        {result && result !== "error" && result.ok && (
          <>
            <CircleCheckIcon aria-hidden="true" className="text-positive mt-0.5 size-4 shrink-0" />
            {t("verifyOk", {
              count: result.checked,
              number: formatNumber(result.checked, locale),
              time: formatTime(result.verifiedAt, locale),
            })}
          </>
        )}
        {result && result !== "error" && !result.ok && (
          <>
            <CircleAlertIcon
              aria-hidden="true"
              className="text-destructive mt-0.5 size-4 shrink-0"
            />
            <span className="font-semibold">
              {t("verifyBroken", { seq: formatNumber(result.brokenAt ?? 0, locale) })}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
