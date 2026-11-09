"use server";

import { api } from "@onn/api-client";
import { getTranslations } from "next-intl/server";
import type { FieldErrors } from "@/components/forms/form-parts";
import { EMAIL, formLocale, problemFields, text } from "@/lib/forms";

export interface ApiKeyValues {
  name: string;
  email: string;
  organisation: string;
  intendedUse: string;
  acceptedTerms: boolean;
}

export interface ApiKeyState {
  status: "idle" | "done" | "error";
  errors: FieldErrors;
  values: ApiKeyValues;
  failed?: boolean;
}

const FIELDS = ["name", "email", "organisation", "intendedUse", "acceptedTerms"] as const;
const USE_MAX = 1000;

/** "Get an API key" (brief §5.9). A Server Action, so the form works without JavaScript. */
export async function requestApiKey(
  _previous: ApiKeyState,
  formData: FormData,
): Promise<ApiKeyState> {
  const locale = formLocale(formData);
  const t = await getTranslations({ locale, namespace: "Developers" });
  const values: ApiKeyValues = {
    name: text(formData, "name"),
    email: text(formData, "email"),
    organisation: text(formData, "organisation"),
    intendedUse: text(formData, "intendedUse"),
    acceptedTerms: formData.get("acceptedTerms") === "on",
  };
  const messages: Record<(typeof FIELDS)[number], string> = {
    name: t("errors.name"),
    email: t("errors.email"),
    organisation: t("errors.organisation"),
    intendedUse: t("errors.intendedUse"),
    acceptedTerms: t("errors.acceptedTerms"),
  };

  const errors: FieldErrors = {};
  if (!values.name) errors.name = messages.name;
  if (!EMAIL.test(values.email)) errors.email = messages.email;
  if (!values.organisation) errors.organisation = messages.organisation;
  if (!values.intendedUse || values.intendedUse.length > USE_MAX) {
    errors.intendedUse = messages.intendedUse;
  }
  if (!values.acceptedTerms) errors.acceptedTerms = messages.acceptedTerms;
  if (Object.keys(errors).length) return { status: "error", errors, values };

  try {
    await api.requestApiKey({ locale }, values);
    return { status: "done", errors: {}, values };
  } catch (error) {
    const fields = problemFields(error).filter((name): name is (typeof FIELDS)[number] =>
      (FIELDS as readonly string[]).includes(name),
    );
    if (fields.length) {
      return {
        status: "error",
        errors: Object.fromEntries(fields.map((name) => [name, messages[name]])),
        values,
      };
    }
    return { status: "error", errors: {}, values, failed: true };
  }
}
