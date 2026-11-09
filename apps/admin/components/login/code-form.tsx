"use client";

import { CodeInput } from "@onn/ui/components/code-input";
import { Button } from "@onn/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { verifyCode, type CodeState } from "@/app/actions";

const DIGITS = 6;

/** MFA step (brief §7): six boxes, submits without JavaScript too. */
export function CodeForm() {
  const t = useTranslations("Admin.login");
  const [state, action, pending] = useActionState<CodeState, FormData>(verifyCode, {});
  const form = useRef<HTMLFormElement>(null);

  // After an error, clear the boxes and put the cursor back in the first one.
  useEffect(() => {
    if (!state.error || !form.current) return;
    const boxes = form.current.querySelectorAll<HTMLInputElement>("input[name=code]");
    boxes.forEach((box) => (box.value = ""));
    boxes[0]?.focus();
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-4">
      <CodeInput
        name="code"
        label={t("codeLabel")}
        digitLabels={Array.from({ length: DIGITS }, (_, index) =>
          t("digit", { n: index + 1, total: DIGITS }),
        )}
        error={state.error ? t(`codeError.${state.error}`) : undefined}
        disabled={pending}
      />
      <p className="text-muted-foreground text-sm">{t("codeHint")}</p>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("verifying") : t("verify")}
      </Button>
    </form>
  );
}
