import type { AdminRole, SubmissionAction, SubmissionStatus } from "@onn/api-client/types";
import { can } from "@onn/api-client/permissions";
import type { StatusTone } from "@onn/ui/components/status-pill";

export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "draft",
  "submitted",
  "verified",
  "approved",
  "published",
  "returned",
];

/** The stepper's steps (brief §7); "returned" shows on the Submitted step. */
export const STEPS: SubmissionStatus[] = [
  "draft",
  "submitted",
  "verified",
  "approved",
  "published",
];

export const STATUS_TONE: Record<SubmissionStatus, StatusTone> = {
  draft: "neutral",
  submitted: "info",
  verified: "info",
  approved: "positive",
  published: "positive",
  returned: "warning",
};

/** Which actions each status accepts; mirrors the API so buttons appear only when they'd work. */
const FROM: Record<SubmissionAction, SubmissionStatus[]> = {
  submit: ["draft", "returned"],
  verify: ["submitted"],
  approve: ["verified"],
  publish: ["approved"],
  return: ["submitted", "verified", "approved"],
};

/** The order buttons appear in the action bar. */
export const ACTION_ORDER: SubmissionAction[] = [
  "submit",
  "verify",
  "approve",
  "publish",
  "return",
];

/** Actions the role may take on a submission in this status (hidden otherwise, brief §7). */
export function availableActions(roles: AdminRole[], status: SubmissionStatus) {
  return ACTION_ORDER.filter(
    (action) => can(roles, `submission.${action}`) && FROM[action].includes(status),
  );
}

/** Actions the role may take on any status, for the bulk bar. */
export function bulkActions(roles: AdminRole[]) {
  return ACTION_ORDER.filter((action) => action !== "submit" && can(roles, `submission.${action}`));
}

export const PAGE_SIZES = [25, 50, 100];
