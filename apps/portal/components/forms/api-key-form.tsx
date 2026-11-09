"use client";

import { Button } from "@onn/ui/components/ui/button";
import { CheckCircle2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { Link } from "@/i18n/navigation";
import type { ApiKeyState } from "@/app/[locale]/(site)/developers/actions";
import { requestApiKey } from "@/app/[locale]/(site)/developers/actions";
import { describedBy, ErrorSummary, FieldError } from "./form-parts";

const ID = "apikey";
const ORDER = ["name", "email", "organisation", "intendedUse", "acceptedTerms"];

/** "Get an API key" (brief §5.9) → confirmation screen. */
export function ApiKeyForm() {
  const t = useTranslations("Developers");
  const locale = useLocale();
  const [state, action, pending] = useActionState(requestApiKey, {
    status: "idle",
    errors: {},
    values: { name: "", email: "", organisation: "", intendedUse: "", acceptedTerms: false },
  } satisfies ApiKeyState);

  if (state.status === "done") {
    return (
      <div role="status" className="bg-surface-2 rounded-lg p-6">
        <h3 className="flex items-center gap-2">
          <CheckCircle2Icon aria-hidden className="text-positive size-6" />
          {t("confirmTitle")}
        </h3>
        <p className="mt-2">{t("confirmBody", { email: state.values.email })}</p>
      </div>
    );
  }

  const { errors, values } = state;
  const field = (
    name: "name" | "email" | "organisation",
    type: "text" | "email",
    autoComplete: string,
  ) => (
    <div>
      <label htmlFor={`${ID}-${name}`} className="font-semibold">
        {t(`fields.${name}`)}
      </label>
      <input
        id={`${ID}-${name}`}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        defaultValue={values[name]}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={describedBy(errors[name] && `${ID}-${name}-error`)}
        className="mt-1 h-11 w-full rounded-md border bg-white px-3"
      />
      <FieldError id={`${ID}-${name}-error`} message={errors[name]} />
    </div>
  );

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <ErrorSummary title={t("errorTitle")} errors={errors} idPrefix={ID} order={ORDER} />
      {state.failed && (
        <p role="alert" className="border-negative rounded-md border-2 bg-white p-4">
          {t("failed")}
        </p>
      )}
      {field("name", "text", "name")}
      {field("email", "email", "email")}
      {field("organisation", "text", "organization")}
      <div>
        <label htmlFor={`${ID}-intendedUse`} className="font-semibold">
          {t("fields.intendedUse")}
        </label>
        <p id={`${ID}-intendedUse-hint`} className="text-muted-foreground text-sm">
          {t("intendedUseHint")}
        </p>
        <textarea
          id={`${ID}-intendedUse`}
          name="intendedUse"
          rows={4}
          maxLength={1000}
          required
          defaultValue={values.intendedUse}
          aria-invalid={Boolean(errors.intendedUse)}
          aria-describedby={describedBy(
            `${ID}-intendedUse-hint`,
            errors.intendedUse && `${ID}-intendedUse-error`,
          )}
          className="mt-1 w-full rounded-md border bg-white p-3"
        />
        <FieldError id={`${ID}-intendedUse-error`} message={errors.intendedUse} />
      </div>
      <div>
        <div className="flex items-start gap-3">
          <input
            id={`${ID}-acceptedTerms`}
            name="acceptedTerms"
            type="checkbox"
            required
            defaultChecked={values.acceptedTerms}
            aria-invalid={Boolean(errors.acceptedTerms)}
            aria-describedby={describedBy(errors.acceptedTerms && `${ID}-acceptedTerms-error`)}
            className="accent-primary mt-0.5 size-6 shrink-0"
          />
          <label htmlFor={`${ID}-acceptedTerms`}>
            {t.rich("fields.acceptedTerms", {
              terms: (chunks) => (
                <Link href="/legal/terms" className="text-primary underline">
                  {chunks}
                </Link>
              ),
            })}
          </label>
        </div>
        <FieldError id={`${ID}-acceptedTerms-error`} message={errors.acceptedTerms} />
      </div>
      <Button type="submit" loading={pending} className="self-start">
        {t("submit")}
      </Button>
    </form>
  );
}
