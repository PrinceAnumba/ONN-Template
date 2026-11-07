"use client";

import { Button } from "@onn/ui/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@onn/ui/components/ui/sheet";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SelectorFields, type Selection, type SelectorGroups } from "./selector-fields";

interface SelectorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: SelectorGroups;
  value: Selection;
  onApply: (next: Selection) => void;
  onClosed: () => void;
}

export default function SelectorSheet({
  open,
  onOpenChange,
  groups,
  value,
  onApply,
  onClosed,
}: SelectorSheetProps) {
  const t = useTranslations("Selector");
  const common = useTranslations("Common");
  const [draft, setDraft] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    setDraft(value);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        closeLabel={common("close")}
        // The first field opens full-screen on focus, which would hide the sheet.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
        // Esc inside an open combobox only closes its list.
        onEscapeKeyDown={(event) => {
          if (document.activeElement?.getAttribute("aria-expanded") === "true") {
            event.preventDefault();
          }
        }}
        className="rounded-t-lg p-4"
      >
        <SheetHeader className="p-0">
          <SheetTitle>{t("chooseData")}</SheetTitle>
          <SheetDescription className="sr-only">{t("indicator")}</SheetDescription>
        </SheetHeader>
        <SelectorFields
          groups={groups}
          value={draft}
          onChange={setDraft}
          className="flex flex-col gap-3"
        />
        <Button onClick={() => onApply(draft)} className="h-11">
          {common("apply")}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
