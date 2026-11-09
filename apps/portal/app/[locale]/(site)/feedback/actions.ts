"use server";

import { api } from "@onn/api-client";
import { getTranslations } from "next-intl/server";
import type { FieldErrors } from "@/components/forms/form-parts";
import { EMAIL, formLocale, MESSAGE_MAX, problemFields, safePath, text } from "@/lib/forms";

export interface FeedbackValues {
  rating: string;
  message: string;
  email: string;
}

export interface FeedbackState {
  status: "idle" | "done" | "error";
  errors: FieldErrors;
  values: FeedbackValues;
  /** True when the server couldn't be reached, as opposed to invalid input. */
  failed?: boolean;
  page: string;
}

/** Feedback form (brief §5.9). A Server Action, so the form also works without JavaScript. */
export async function submitFeedback(
  _previous: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const locale = formLocale(formData);
  const t = await getTranslations({ locale, namespace: "Feedback" });
  const values: FeedbackValues = {
    rating: text(formData, "rating"),
    message: text(formData, "message"),
    email: text(formData, "email"),
  };
  const page = safePath(text(formData, "page"));
  const rating = Number(values.rating);

  const errors: FieldErrors = {};
  if (!values.rating && !values.message) errors.rating = t("errors.empty");
  if (values.rating && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    errors.rating = t("errors.rating");
  }
  if (values.message.length > MESSAGE_MAX) errors.message = t("errors.tooLong");
  if (values.email && !EMAIL.test(values.email)) errors.email = t("errors.email");
  if (Object.keys(errors).length) return { status: "error", errors, values, page };

  try {
    await api.feedback(
      { locale },
      {
        rating: values.rating ? rating : undefined,
        message: values.message || undefined,
        email: values.email || undefined,
        page,
      },
    );
    return { status: "done", errors: {}, values, page };
  } catch (error) {
    const fields = problemFields(error);
    if (fields.length) {
      const known = ["rating", "message", "email"];
      return {
        status: "error",
        errors: Object.fromEntries(
          fields
            .filter((name) => known.includes(name))
            .map((name) => [name, t(`errors.${name === "message" ? "tooLong" : name}`)]),
        ),
        values,
        page,
      };
    }
    return { status: "error", errors: {}, values, page, failed: true };
  }
}
