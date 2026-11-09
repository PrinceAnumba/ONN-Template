"use client";

import { Button } from "@onn/ui/components/ui/button";
import { cn } from "@onn/ui/lib/utils";
import { CheckCircle2Icon, StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { FeedbackState } from "@/app/[locale]/(site)/feedback/actions";
import { submitFeedback } from "@/app/[locale]/(site)/feedback/actions";
import { describedBy, ErrorSummary, FieldError } from "./form-parts";

const MAX = 2000;
const WARN_AT = 1900;
const ID = "feedback";
const RATINGS = [1, 2, 3, 4, 5] as const;

/** Feedback (brief §5.9): five large stars, a counted message, optional email, page context. */
export function FeedbackForm({ page, errorId }: { page: string; errorId?: string }) {
  const t = useTranslations("Feedback");
  const locale = useLocale();
  const [state, action, pending] = useActionState(submitFeedback, {
    status: "idle",
    errors: {},
    values: { rating: "", message: "", email: "" },
    page,
  } satisfies FeedbackState);
  const [message, setMessage] = useState(state.values.message);
  const [rating, setRating] = useState(state.values.rating);
  const count = new Intl.NumberFormat(locale);

  if (state.status === "done") {
    return (
      <div role="status" className="bg-surface-2 max-w-prose rounded-lg p-6">
        <h2 className="flex items-center gap-2">
          <CheckCircle2Icon aria-hidden className="text-positive size-6" />
          {t("thanks")}
        </h2>
        <p className="mt-2">{t("thanksBody")}</p>
        <Button asChild className="mt-4">
          <Link href={state.page}>{t("back")}</Link>
        </Button>
      </div>
    );
  }

  const { errors } = state;
  return (
    <form action={action} noValidate className="flex max-w-prose flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="page" value={page} />
      {errorId && <input type="hidden" name="errorId" value={errorId} />}
      <ErrorSummary
        title={t("errorTitle")}
        errors={errors}
        idPrefix={ID}
        order={["rating", "message", "email"]}
      />
      {state.failed && (
        <p role="alert" className="border-negative rounded-md border-2 bg-white p-4">
          {t("failed")}
        </p>
      )}

      <fieldset aria-describedby={describedBy(errors.rating && `${ID}-rating-error`)}>
        <legend className="font-semibold">{t("rating")}</legend>
        <div id={`${ID}-rating`} tabIndex={-1} className="mt-2 flex flex-wrap gap-1">
          {RATINGS.map((value) => {
            const on = Number(rating) >= value;
            return (
              <label
                key={value}
                className="flex min-w-14 cursor-pointer flex-col items-center gap-1 rounded-md p-1 has-[:focus-visible]:shadow-(--onn-focus)"
              >
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  defaultChecked={state.values.rating === String(value)}
                  onChange={() => setRating(String(value))}
                  className="sr-only"
                />
                <StarIcon
                  aria-hidden
                  className={cn(
                    "size-11",
                    on ? "fill-at-risk text-at-risk" : "text-muted-foreground",
                  )}
                />
                <span className="text-center text-xs leading-tight">{t(`stars.${value}`)}</span>
              </label>
            );
          })}
        </div>
        <FieldError id={`${ID}-rating-error`} message={errors.rating} />
      </fieldset>

      <div>
        <label htmlFor={`${ID}-message`} className="font-semibold">
          {t("message")}
        </label>
        <p id={`${ID}-message-hint`} className="text-muted-foreground text-sm">
          {t("messageHint", { max: count.format(MAX) })}
        </p>
        <textarea
          id={`${ID}-message`}
          name="message"
          rows={6}
          maxLength={MAX}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy(
            `${ID}-message-hint`,
            errors.message && `${ID}-message-error`,
          )}
          className="mt-1 w-full rounded-md border bg-white p-3"
        />
        <p
          aria-hidden
          className={cn(
            "text-end text-sm tabular-nums",
            message.length >= WARN_AT ? "text-foreground font-semibold" : "text-muted-foreground",
          )}
        >
          {t("counter", { count: count.format(message.length), max: count.format(MAX) })}
        </p>
        {/* Announced only near the limit, so typing isn't read out on every key. */}
        <p role="status" className="sr-only">
          {message.length >= WARN_AT ? t("remaining", { count: MAX - message.length }) : ""}
        </p>
        <FieldError id={`${ID}-message-error`} message={errors.message} />
      </div>

      <div>
        <label htmlFor={`${ID}-email`} className="font-semibold">
          {t("email")}
        </label>
        <p id={`${ID}-email-hint`} className="text-muted-foreground text-sm">
          {t("emailHint")}
        </p>
        <input
          id={`${ID}-email`}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describedBy(`${ID}-email-hint`, errors.email && `${ID}-email-error`)}
          className="mt-1 h-11 w-full rounded-md border bg-white px-3"
        />
        <FieldError id={`${ID}-email-error`} message={errors.email} />
      </div>

      <p className="text-muted-foreground text-sm">
        {t("context")}
        <code className="bg-surface-2 ms-1 rounded px-1 break-all">{page}</code>
      </p>
      {errorId && (
        <p className="text-muted-foreground -mt-4 text-sm">
          {t("errorReference")}
          <code className="bg-surface-2 ms-1 rounded px-1 break-all">{errorId}</code>
        </p>
      )}

      <Button type="submit" loading={pending} className="self-start">
        {t("submit")}
      </Button>
    </form>
  );
}
