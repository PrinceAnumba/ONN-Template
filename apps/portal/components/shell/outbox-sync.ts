// Loaded only when the outbox has items (see offline-status.tsx), so pages don't carry it.
import { api } from "@onn/api-client";
import { showToast } from "@onn/ui/components/toast";
import { submitFeedback, type FeedbackState } from "@/app/[locale]/(site)/feedback/actions";
import { readOutbox, removeFromOutbox, type OutboxItem } from "@/lib/outbox";

export interface OutboxLabels {
  feedbackSent: string;
  subscribeSent: string;
  sendFailed: string;
}

type Result = "sent" | "rejected" | "offline";

async function send(item: OutboxItem): Promise<Result> {
  if (item.kind === "subscribe") {
    try {
      await api.subscribe({ locale: item.locale }, { email: item.email, locale: item.locale });
      return "sent";
    } catch (error) {
      return error instanceof TypeError ? "offline" : "rejected";
    }
  }
  const form = new FormData();
  for (const [key, value] of Object.entries(item.fields)) form.set(key, value);
  const initial: FeedbackState = {
    status: "idle",
    errors: {},
    values: { rating: "", message: "", email: "" },
    page: item.fields.page ?? "/",
  };
  try {
    const state = await submitFeedback(initial, form);
    if (state.status === "done") return "sent";
    return state.failed ? "offline" : "rejected";
  } catch {
    return "offline";
  }
}

let running = false;

/** Sends each saved form once; keeps the ones that still can't reach the server. */
export async function flushOutbox(labels: OutboxLabels) {
  if (running || !navigator.onLine) return;
  running = true;
  try {
    for (const item of readOutbox()) {
      const result = await send(item);
      if (result === "offline") break;
      removeFromOutbox(item.id);
      if (result === "rejected") showToast(labels.sendFailed, "error");
      else showToast(item.kind === "feedback" ? labels.feedbackSent : labels.subscribeSent);
    }
  } finally {
    running = false;
  }
}
