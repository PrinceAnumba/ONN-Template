"use client";

import type { SubmissionAction } from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { transitionSubmission } from "@/app/(app)/submissions/actions";
import { ReturnDialog } from "./return-dialog";

const KNOWN_REASONS = [
  "role",
  "state",
  "own-submission",
  "errors",
  "unjustified",
  "comment",
  "scope",
];

/**
 * Action bar (brief §7): only the transitions the role may take. "Approve" on your own submission
 * is the one disabled button, because the rule depends on data; the reason is shown beside it.
 */
export function SubmissionActions({
  id,
  actions,
  ownSubmission,
}: {
  id: string;
  actions: SubmissionAction[];
  /** The signed-in user submitted this one, so they can't approve it. */
  ownSubmission: boolean;
}) {
  const t = useTranslations("Admin.submissions");
  const router = useRouter();
  const hintId = useId();
  const [returning, setReturning] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (action: SubmissionAction, comment?: string) =>
    startTransition(async () => {
      const result = await transitionSubmission(id, action, comment);
      if (result.ok) {
        setReturning(false);
        showToast(t(`done.${action}`, { id }));
        router.refresh();
      } else {
        const reason = KNOWN_REASONS.includes(result.reason) ? result.reason : "other";
        showToast(t(`refused.${reason}`), "error");
      }
    });

  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => {
        const blocked = action === "approve" && ownSubmission;
        return (
          <Button
            key={action}
            variant={action === "return" ? "secondary" : "primary"}
            disabled={pending}
            // aria-disabled keeps it focusable, so the reason is found with the keyboard too.
            aria-disabled={blocked || undefined}
            aria-describedby={blocked ? hintId : undefined}
            onClick={() => {
              if (blocked) return;
              if (action === "return") setReturning(true);
              else run(action);
            }}
            className={blocked ? "cursor-not-allowed opacity-45" : undefined}
          >
            {t(`action.${action}`)}
          </Button>
        );
      })}
      {ownSubmission && actions.includes("approve") && (
        <p id={hintId} className="text-muted-foreground text-sm">
          {t("ownSubmission")}
        </p>
      )}
      <ReturnDialog
        open={returning}
        onOpenChange={setReturning}
        count={1}
        pending={pending}
        onConfirm={(comment) => run("return", comment)}
      />
    </div>
  );
}
