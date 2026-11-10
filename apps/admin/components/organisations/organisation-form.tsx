"use client";

import type {
  OrgContact,
  Organisation,
  OrganisationAdmin,
  OrganisationRecord,
} from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { LoaderCircleIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  AREA,
  ErrorSummary,
  errorCode,
  FIELD,
  FieldMessage,
  useFormErrors,
} from "@/components/forms/form-errors";
import { LanguageSwitch } from "@/components/forms/language-switch";
import { bff } from "@/lib/bff";
import { ORG_KINDS } from "@/lib/governance";
import { useLanguageName } from "@/lib/languages";
import { useUnsavedWarning } from "@/lib/use-unsaved";

const CONTACT_FIELDS = ["name", "role", "email", "phone"] as const;
type ContactField = (typeof CONTACT_FIELDS)[number];

/** Organisation profile and contacts (brief §7). Name and description are kept per language. */
export function OrganisationForm({
  initial,
  locales,
  defaultLocale,
}: {
  initial: OrganisationAdmin;
  locales: string[];
  defaultLocale: string;
}) {
  const t = useTranslations("Admin.organisations");
  const forms = useTranslations("Admin.forms");
  const languageName = useLanguageName();
  const router = useRouter();
  const form = useFormErrors();
  const [record, setRecord] = useState<OrganisationRecord>({
    name: initial.name,
    kind: initial.kind,
    description: initial.description,
    website: initial.website ?? "",
    contacts: initial.contacts,
  });
  const [language, setLanguage] = useState(defaultLocale);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  useUnsavedWarning(dirty);
  const change = (patch: Partial<OrganisationRecord>) => {
    setRecord({ ...record, ...patch });
    setDirty(true);
  };
  const setContact = (index: number, patch: Partial<OrgContact>) =>
    change({
      contacts: record.contacts.map((contact, at) =>
        at === index ? { ...contact, ...patch } : contact,
      ),
    });
  const errorText = (path: string) => {
    const error = form.errorFor(path);
    return error ? forms(`error.${errorCode(error.message)}`) : undefined;
  };
  /** "Contact 2, Email" or "Name (French)": where a server path points, in words. */
  const fieldLabel = (path: string) => {
    const [head, second, third] = path.split(".");
    if (head === "contacts" && third) {
      return forms("errorIn", {
        where: t("contactN", { n: Number(second) + 1 }),
        field: t(`contact.${third as ContactField}`),
      });
    }
    if ((head === "name" || head === "description") && second) {
      return forms("fieldIn", { field: t(`field.${head}`), language: languageName(second) });
    }
    return t(`field.${head as "kind"}`);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    form.clear();
    setSaving(true);
    try {
      await bff<OrganisationAdmin>(`/organisations/${initial.code}`, {
        method: "PUT",
        body: record,
      });
      setDirty(false);
      showToast(t("saved"));
      router.refresh();
    } catch (error) {
      if (form.show(error)) {
        // Show the language that holds the first text error.
        const first = (error as { errors: { path: string }[] }).errors
          .map((item) => item.path.split("."))
          .find(([head, code]) => (head === "name" || head === "description") && code);
        if (first?.[1]) setLanguage(first[1]);
      } else showToast(forms("saveFailed"), "error");
    } finally {
      setSaving(false);
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
            field: fieldLabel(error.path),
            message: forms(`error.${errorCode(error.message)}`),
          }),
          onClick: () => {
            const [head, code] = error.path.split(".");
            if ((head === "name" || head === "description") && code) setLanguage(code);
            requestAnimationFrame(() => document.getElementById(form.fieldId(error.path))?.focus());
          },
        }))}
      />
      <LanguageSwitch
        locales={locales}
        value={language}
        onChange={setLanguage}
        flagged={locales.filter((code) =>
          form.errors.some((error) => error.path.endsWith(`.${code}`)),
        )}
      />
      {(["name", "description"] as const).map((field) => {
        const path = `${field}.${language}`;
        const label = forms("fieldIn", {
          field: t(`field.${field}`),
          language: languageName(language),
        });
        const shared = {
          id: form.fieldId(path),
          lang: language,
          value: record[field][language] ?? "",
          "aria-invalid": Boolean(form.errorFor(path)),
          "aria-describedby": form.describedBy(path),
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            change({ [field]: { ...record[field], [language]: event.target.value } }),
        };
        return (
          <div key={field}>
            <label htmlFor={form.fieldId(path)} className="mb-1 block font-semibold">
              {label}
            </label>
            {field === "name" ? (
              <input {...shared} className={FIELD} maxLength={120} />
            ) : (
              <textarea {...shared} className={AREA} maxLength={600} rows={3} />
            )}
            <FieldMessage id={`${form.fieldId(path)}-error`} text={errorText(path)} />
          </div>
        );
      })}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={form.fieldId("kind")} className="mb-1 block font-semibold">
            {t("field.kind")}
          </label>
          <select
            id={form.fieldId("kind")}
            className={FIELD}
            value={record.kind}
            aria-invalid={Boolean(form.errorFor("kind"))}
            aria-describedby={form.describedBy("kind")}
            onChange={(event) => change({ kind: event.target.value as Organisation["kind"] })}
          >
            {ORG_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`kind.${kind}`)}
              </option>
            ))}
          </select>
          <FieldMessage id={`${form.fieldId("kind")}-error`} text={errorText("kind")} />
        </div>
        <div>
          <label htmlFor={form.fieldId("website")} className="mb-1 block font-semibold">
            {t("field.website")} <span className="font-normal">{forms("optional")}</span>
          </label>
          <input
            id={form.fieldId("website")}
            type="url"
            inputMode="url"
            className={FIELD}
            value={record.website ?? ""}
            maxLength={200}
            aria-invalid={Boolean(form.errorFor("website"))}
            aria-describedby={form.describedBy("website")}
            onChange={(event) => change({ website: event.target.value })}
          />
          <FieldMessage id={`${form.fieldId("website")}-error`} text={errorText("website")} />
        </div>
      </div>

      <section aria-labelledby={form.fieldId("contacts")}>
        <h2 id={form.fieldId("contacts")} tabIndex={-1} className="text-h3">
          {t("contacts")}
        </h2>
        <FieldMessage id={`${form.fieldId("contacts")}-error`} text={errorText("contacts")} />
        {record.contacts.length === 0 && (
          <p className="text-muted-foreground mt-2">{t("noContacts")}</p>
        )}
        <div className="mt-3 flex flex-col gap-4">
          {record.contacts.map((contact, index) => (
            // Contacts have no id; the position is their identity while editing.
            <fieldset key={index} className="min-w-0 rounded-lg border p-4">
              <legend className="px-1 font-semibold">{t("contactN", { n: index + 1 })}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                {CONTACT_FIELDS.map((field) => {
                  const path = `contacts.${index}.${field}`;
                  return (
                    <div key={field}>
                      <label htmlFor={form.fieldId(path)} className="mb-1 block font-semibold">
                        {t(`contact.${field}`)}{" "}
                        {(field === "role" || field === "phone") && (
                          <span className="font-normal">{forms("optional")}</span>
                        )}
                      </label>
                      <input
                        id={form.fieldId(path)}
                        type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                        className={FIELD}
                        value={contact[field] ?? ""}
                        maxLength={field === "phone" ? 30 : 120}
                        autoComplete="off"
                        aria-invalid={Boolean(form.errorFor(path))}
                        aria-describedby={form.describedBy(path)}
                        onChange={(event) => setContact(index, { [field]: event.target.value })}
                      />
                      <FieldMessage id={`${form.fieldId(path)}-error`} text={errorText(path)} />
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="mt-3"
                onClick={() => {
                  change({ contacts: record.contacts.filter((_, at) => at !== index) });
                  // The removed block took focus with it.
                  addButton.current?.focus();
                }}
              >
                <Trash2Icon aria-hidden="true" />
                {t("removeContact", { n: index + 1 })}
              </Button>
            </fieldset>
          ))}
        </div>
        {record.contacts.length < 10 && (
          <Button
            ref={addButton}
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() =>
              change({ contacts: [...record.contacts, { name: "", role: "", email: "" }] })
            }
          >
            <PlusIcon aria-hidden="true" />
            {t("addContact")}
          </Button>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving && <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />}
          {forms("save")}
        </Button>
        {dirty && <p className="text-muted-foreground text-sm">{forms("unsaved")}</p>}
      </div>
    </form>
  );
}
