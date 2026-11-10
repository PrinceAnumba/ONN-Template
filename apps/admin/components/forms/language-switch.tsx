"use client";

import { cn } from "@onn/ui/lib/utils";
import { useTranslations } from "next-intl";
import { useLanguageName } from "@/lib/languages";

/**
 * Picks which language's text the fields below show. Toggle buttons, not tabs: the fields stay
 * the same and only their content changes. Languages with errors are marked in words.
 */
export function LanguageSwitch({
  locales,
  value,
  onChange,
  flagged = [],
}: {
  locales: string[];
  value: string;
  onChange: (locale: string) => void;
  /** Languages holding a field error. */
  flagged?: string[];
}) {
  const t = useTranslations("Admin.forms");
  const languageName = useLanguageName();
  if (locales.length < 2) return null;
  return (
    <div role="group" aria-label={t("languageGroup")} className="flex flex-wrap gap-2">
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={value === code}
          onClick={() => onChange(code)}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-md border px-4 font-semibold",
            value === code ? "bg-primary text-primary-foreground border-primary" : "bg-background",
          )}
        >
          {languageName(code)}
          {flagged.includes(code) && (
            <>
              <span aria-hidden="true" className="bg-destructive rounded-pill size-2" />
              <span className="sr-only">{t("languageErrors")}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
