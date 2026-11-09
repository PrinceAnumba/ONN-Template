"use server";

import { ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import type { BulkTransitionResult, QualityRule, SubmissionAction } from "@onn/api-client/types";
import { revalidatePath } from "next/cache";
import { adminContext } from "@/lib/session";

const ACTIONS: SubmissionAction[] = ["submit", "verify", "approve", "publish", "return"];
const RULES: QualityRule[] = ["missing", "negative", "range", "jump", "duplicate"];

export type TransitionResult = { ok: true } | { ok: false; reason: string };

/** Why the API refused, as a message key: the Problem `type`, or the HTTP status. */
function reasonOf(error: unknown) {
  if (error instanceof ApiError)
    return error.problem.type !== "about:blank" ? error.problem.type : String(error.status);
  return "network";
}

export async function transitionSubmission(
  id: string,
  action: SubmissionAction,
  comment?: string,
): Promise<TransitionResult> {
  if (!ACTIONS.includes(action)) return { ok: false, reason: "state" };
  try {
    await adminApi.transition(await adminContext(), id, { action, comment });
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function bulkTransition(
  ids: string[],
  action: SubmissionAction,
  comment?: string,
): Promise<BulkTransitionResult | { error: string }> {
  if (!ACTIONS.includes(action)) return { error: "state" };
  try {
    const result = await adminApi.bulkTransition(
      await adminContext(),
      ids.slice(0, 100),
      action,
      comment,
    );
    revalidatePath("/", "layout");
    return result;
  } catch (error) {
    return { error: reasonOf(error) };
  }
}

export interface JustifyState {
  saved?: boolean;
  error?: string;
}

/** Saves the explanations typed for failing warnings (brief §7 *Quality* tab). */
export async function saveJustifications(
  id: string,
  _state: JustifyState,
  formData: FormData,
): Promise<JustifyState> {
  const justifications = Object.fromEntries(
    RULES.filter((rule) => formData.has(rule)).map((rule) => [
      rule,
      String(formData.get(rule) ?? ""),
    ]),
  );
  try {
    await adminApi.justify(await adminContext(), id, justifications);
  } catch (error) {
    return { error: reasonOf(error) };
  }
  revalidatePath(`/submissions/${id}`);
  return { saved: true };
}
