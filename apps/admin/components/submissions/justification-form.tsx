"use client";

import type { QualityResult } from "@onn/api-client/types";
import { Button } from "@onn/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { saveJustifications, type JustifyState } from "@/app/(app)/submissions/actions";

/** One explanation per failing warning (brief §7 *Quality* tab), required before verifying. */
export function JustificationForm({ id, warnings }: { id: string; warnings: QualityResult[] }) {
  const t = useTranslations("Admin.quality");
  const [state, action, pending] = useActionState<JustifyState, FormData>(
    saveJustifications.bind(null, id),
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      {warnings.map((warning) => (
        <div key={warning.rule} className="flex flex-col gap-1">
          <label htmlFor={`justify-${warning.rule}`} className="text-sm font-semibold">
            {t("justifyLabel", { rule: t(`rule.${warning.rule}`) })}
          </label>
          <textarea
            id={`justify-${warning.rule}`}
            name={warning.rule}
            defaultValue={warning.justification ?? ""}
            rows={3}
            maxLength={1000}
            aria-describedby={`justify-${warning.rule}-hint`}
            className="border-input bg-background rounded-md border p-3"
          />
          <p id={`justify-${warning.rule}-hint`} className="text-muted-foreground text-xs">
            {t("justifyHint")}
          </p>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {t("save")}
        </Button>
        <p role="status" className="text-sm">
          {state.saved ? t("saved") : state.error ? t("saveFailed") : ""}
        </p>
      </div>
    </form>
  );
}
