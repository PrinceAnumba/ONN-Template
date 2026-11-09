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
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

/** "Return" needs a comment (brief §7): the contributor sees it in the history. */
export function ReturnDialog({
  open,
  onOpenChange,
  count,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of submissions being returned (1 on the detail page). */
  count: number;
  pending: boolean;
  onConfirm: (comment: string) => void;
}) {
  const t = useTranslations("Admin.submissions.return");
  const common = useTranslations("Common");
  const [comment, setComment] = useState("");
  const [error, setError] = useState(false);
  const restoreFocus = useRestoreFocus(open);
  const id = useId();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(false);
        onOpenChange(next);
      }}
    >
      <DialogContent closeLabel={common("close")} onCloseAutoFocus={restoreFocus}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!comment.trim()) {
              setError(true);
              document.getElementById(`${id}-comment`)?.focus();
              return;
            }
            onConfirm(comment.trim());
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{t("title", { count })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-comment`} className="text-sm font-semibold">
              {t("label")}
            </label>
            <textarea
              id={`${id}-comment`}
              value={comment}
              onChange={(event) => {
                setComment(event.target.value);
                if (event.target.value.trim()) setError(false);
              }}
              rows={4}
              maxLength={2000}
              required
              aria-invalid={error || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className="border-input bg-background rounded-md border p-3"
            />
            {error && (
              <p id={`${id}-error`} className="text-destructive text-sm">
                {t("required")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("confirm", { count })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
