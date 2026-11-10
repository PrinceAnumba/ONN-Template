"use client";

import type { AdminRole, AdminUser, UserInviteInput } from "@onn/api-client/types";
import { StatusPill } from "@onn/ui/components/status-pill";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import {
  ErrorSummary,
  errorCode,
  FIELD,
  FieldMessage,
  useFormErrors,
} from "@/components/forms/form-errors";
import { bff } from "@/lib/bff";
import { formatDate } from "@/lib/format";
import { USER_TONE } from "@/lib/governance";
import { ROLES } from "@/lib/roles";

/**
 * Invite a user, or change one (brief §7): name, role and organisations, plus deactivate,
 * reactivate and resending the invitation. Only a super admin sees the super admin role; a user
 * the viewer can't change is shown read-only with the reason.
 */
export function UserForm({
  initial,
  orgs,
  viewer,
}: {
  /** Absent while inviting. */
  initial?: AdminUser;
  orgs: { code: string; name: string }[];
  viewer: { id: string; superAdmin: boolean };
}) {
  const t = useTranslations("Admin.users");
  const roles = useTranslations("Admin.roles");
  const forms = useTranslations("Admin.forms");
  const locale = useLocale();
  const router = useRouter();
  const form = useFormErrors();
  const [input, setInput] = useState<UserInviteInput>({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    role: initial?.roles[0] ?? "contributor",
    orgs: initial?.orgs.map((org) => org.code) ?? [],
  });
  const [busy, setBusy] = useState<"save" | "deactivate" | "reactivate" | "resend" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const deactivate = useRef<HTMLButtonElement>(null);
  const self = initial?.id === viewer.id;
  // Data-dependent rules: explained on screen instead of hidden.
  const locked = Boolean(initial?.roles.includes("super_admin")) && !viewer.superAdmin;
  const roleOptions = ROLES.filter((role) => viewer.superAdmin || role !== "super_admin");
  const errorText = (path: string) => {
    const error = form.errorFor(path);
    return error ? forms(`error.${errorCode(error.message)}`) : undefined;
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    form.clear();
    setBusy("save");
    try {
      if (initial) {
        const { name, role, orgs: codes } = input;
        await bff<AdminUser>(`/users/${initial.id}`, {
          method: "PUT",
          body: { name, role, orgs: codes },
        });
        showToast(t("saved"));
        router.refresh();
      } else {
        await bff<AdminUser>("/users", { method: "POST", body: input });
        showToast(t("invited", { email: input.email.trim() }));
        router.push("/users?status=invited");
      }
    } catch (error) {
      if (!form.show(error)) showToast(forms("saveFailed"), "error");
    } finally {
      setBusy(null);
    }
  };
  const act = async (action: "deactivate" | "reactivate" | "resend") => {
    if (!initial) return;
    setBusy(action);
    try {
      await bff(`/users/${initial.id}/${action}`, { method: "POST" });
      showToast(t(`done.${action}`, { name: initial.name }));
      setConfirming(false);
      router.refresh();
    } catch {
      showToast(forms("saveFailed"), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <form onSubmit={save} noValidate className="flex max-w-3xl flex-col gap-6">
      <ErrorSummary
        ref={form.summary}
        title={forms("errorTitle", { count: form.errors.length })}
        items={form.errors.map((error) => ({
          href: `#${form.fieldId(error.path)}`,
          text: forms("errorLine", {
            field: t(`field.${error.path as "name"}`),
            message: forms(`error.${errorCode(error.message)}`),
          }),
        }))}
      />
      {initial && (
        <dl className="bg-surface-2 grid gap-4 rounded-lg p-4 sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-sm">{t("column.status")}</dt>
            <dd className="mt-1">
              <StatusPill tone={USER_TONE[initial.status]} label={t(`status.${initial.status}`)} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">{t("column.mfa")}</dt>
            <dd className="mt-1">{t(initial.mfa ? "mfaOn" : "mfaOff")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">{t("column.lastLogin")}</dt>
            <dd className="mt-1">
              {initial.lastLogin ? formatDate(initial.lastLogin, locale, "medium") : t("never")}
            </dd>
          </div>
          {initial.invitedAt && (
            <div>
              <dt className="text-muted-foreground text-sm">{t("invitedOn")}</dt>
              <dd className="mt-1">{formatDate(initial.invitedAt, locale, "medium")}</dd>
            </div>
          )}
        </dl>
      )}
      {locked && <p className="border-s-4 ps-3">{t("locked")}</p>}

      <fieldset disabled={locked} className="flex min-w-0 flex-col gap-6">
        <legend className="sr-only">{t("details")}</legend>
        <div>
          <label htmlFor={form.fieldId("name")} className="mb-1 block font-semibold">
            {t("field.name")}
          </label>
          <input
            id={form.fieldId("name")}
            className={FIELD}
            value={input.name}
            maxLength={80}
            autoComplete="off"
            aria-invalid={Boolean(form.errorFor("name"))}
            aria-describedby={form.describedBy("name")}
            onChange={(event) => setInput({ ...input, name: event.target.value })}
          />
          <FieldMessage id={`${form.fieldId("name")}-error`} text={errorText("name")} />
        </div>
        <div>
          <label htmlFor={form.fieldId("email")} className="mb-1 block font-semibold">
            {t("field.email")}
          </label>
          <input
            id={form.fieldId("email")}
            type="email"
            className={FIELD}
            value={input.email}
            maxLength={120}
            autoComplete="off"
            readOnly={Boolean(initial)}
            aria-invalid={Boolean(form.errorFor("email"))}
            aria-describedby={form.describedBy("email", `${form.fieldId("email")}-hint`)}
            onChange={(event) => setInput({ ...input, email: event.target.value })}
          />
          <p id={`${form.fieldId("email")}-hint`} className="text-muted-foreground mt-1 text-sm">
            {t(initial ? "hint.emailFixed" : "hint.email")}
          </p>
          <FieldMessage id={`${form.fieldId("email")}-error`} text={errorText("email")} />
        </div>
        <div>
          <label htmlFor={form.fieldId("role")} className="mb-1 block font-semibold">
            {t("field.role")}
          </label>
          <select
            id={form.fieldId("role")}
            className={FIELD}
            value={input.role}
            disabled={self}
            aria-invalid={Boolean(form.errorFor("role"))}
            aria-describedby={form.describedBy("role", `${form.fieldId("role")}-hint`)}
            onChange={(event) => setInput({ ...input, role: event.target.value as AdminRole })}
          >
            {(locked ? ROLES : roleOptions).map((role) => (
              <option key={role} value={role}>
                {roles(role)}
              </option>
            ))}
          </select>
          <p id={`${form.fieldId("role")}-hint`} className="text-muted-foreground mt-1 text-sm">
            {self ? t("hint.ownRole") : t(`roleHelp.${input.role}`)}
          </p>
          <FieldMessage id={`${form.fieldId("role")}-error`} text={errorText("role")} />
        </div>
        <fieldset
          id={form.fieldId("orgs")}
          tabIndex={-1}
          aria-describedby={form.describedBy("orgs", `${form.fieldId("orgs")}-hint`)}
          className="min-w-0"
        >
          <legend className="font-semibold">{t("field.orgs")}</legend>
          <p id={`${form.fieldId("orgs")}-hint`} className="text-muted-foreground text-sm">
            {t("hint.orgs")}
          </p>
          <div className="mt-1 grid sm:grid-cols-2">
            {orgs.map((org) => (
              <label key={org.code} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5 shrink-0"
                  checked={input.orgs.includes(org.code)}
                  onChange={(event) =>
                    setInput({
                      ...input,
                      orgs: event.target.checked
                        ? [...input.orgs, org.code]
                        : input.orgs.filter((code) => code !== org.code),
                    })
                  }
                />
                {org.name}
              </label>
            ))}
          </div>
          <FieldMessage id={`${form.fieldId("orgs")}-error`} text={errorText("orgs")} />
        </fieldset>
      </fieldset>

      {!locked && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="submit" disabled={busy !== null}>
            {busy === "save" && (
              <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
            )}
            {initial ? forms("save") : t("sendInvite")}
          </Button>
          {initial && (
            <div className="flex flex-wrap items-center gap-3">
              {initial.status === "invited" && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => act("resend")}
                >
                  {t("resend")}
                </Button>
              )}
              {initial.status === "deactivated" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => act("reactivate")}
                >
                  {t("reactivate")}
                </Button>
              ) : (
                <>
                  {self && (
                    <span id={`${form.fieldId("self")}-reason`} className="text-sm">
                      {t("ownAccount")}
                    </span>
                  )}
                  <Button
                    ref={deactivate}
                    type="button"
                    variant="secondary"
                    aria-disabled={self || undefined}
                    aria-describedby={self ? `${form.fieldId("self")}-reason` : undefined}
                    disabled={busy !== null}
                    onClick={() => !self && setConfirming(true)}
                  >
                    {t("deactivate")}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {initial && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t("deactivateTitle", { name: initial.name })}
          description={t("deactivateHelp")}
          confirm={t("deactivate")}
          danger
          pending={busy === "deactivate"}
          onConfirm={() => act("deactivate")}
        />
      )}
    </form>
  );
}
