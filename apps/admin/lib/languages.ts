"use client";

import { tagFor } from "@onn/config/locale";
import { useLocale } from "next-intl";
import { useMemo } from "react";

/** Language names in the interface language ("anglais"), falling back to the code. */
export function useLanguageName() {
  const locale = useLocale();
  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([tagFor(locale)], { type: "language" });
    } catch {
      names = null;
    }
    return (code: string) => {
      const name = names?.of(code);
      return name && name !== code ? name : code.toUpperCase();
    };
  }, [locale]);
}
