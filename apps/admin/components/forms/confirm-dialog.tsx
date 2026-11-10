"use client";

import { Button } from "@onn/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onn/ui/components/ui/dialog";
import { useRestoreFocus } from "@onn/ui/lib/use-restore-focus";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

/** Asks before something that can't be undone (sending a newsletter, deleting a rule). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirm,
  danger,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The confirm button's words: say what it does, not "OK". */
  confirm: string;
  danger?: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations("Admin.forms");
  const common = useTranslations("Common");
  const restoreFocus = useRestoreFocus(open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={common("close")} onCloseAutoFocus={restoreFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant={danger ? "danger" : "primary"}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending && <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />}
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
