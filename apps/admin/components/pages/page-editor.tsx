"use client";

import type { Localised, PageAdmin, PageBlock, PageRecord } from "@onn/api-client/types";
import { Button } from "@onn/ui/components/ui/button";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { DraftBar, useDraftPublish } from "@/components/forms/draft-bar";
import {
  AREA,
  ErrorSummary,
  errorCode,
  FIELD,
  FieldMessage,
  focusField,
  useFormErrors,
} from "@/components/forms/form-errors";
import { ImageField } from "@/components/forms/image-field";
import { LanguageSwitch } from "@/components/forms/language-switch";
import { portalUrl } from "@/lib/content";
import { BLOCK_TYPES, MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, PAGE_PATHS } from "@/lib/editorial";
import { useLanguageName } from "@/lib/languages";

type Block = PageBlock & { key: number };
type Partner = NonNullable<PageBlock["partners"]>[number];

const empty = (type: PageBlock["type"]): PageBlock => {
  switch (type) {
    case "image":
      return { type, src: "", alt: {} };
    case "table":
      return {
        type,
        rows: [
          [{}, {}],
          [{}, {}],
        ],
      };
    case "partners":
      return { type, partners: [{ name: {} }] };
    default:
      return { type, body: {} };
  }
};

/**
 * Block editor for the About and legal pages (brief §7). One language at a time; blocks move
 * with buttons, so the order can be changed by keyboard and on touch screens alike.
 */
export function PageEditor({
  initial,
  locales,
  defaultLocale,
}: {
  initial: PageAdmin;
  locales: string[];
  defaultLocale: string;
}) {
  const t = useTranslations("Admin.pages");
  const forms = useTranslations("Admin.forms");
  const locale = useLocale();
  const languageName = useLanguageName();
  const form = useFormErrors();
  const nextKey = useRef(initial.blocks.length);
  const [title, setTitle] = useState(initial.title);
  const [blocks, setBlocks] = useState<Block[]>(
    initial.blocks.map((block, key) => ({ ...block, key })),
  );
  const [language, setLanguage] = useState(defaultLocale);
  const [announcement, setAnnouncement] = useState("");
  const draft = useDraftPublish<PageAdmin>({
    path: `/pages/${initial.slug}`,
    initial,
    body: (): PageRecord => ({
      title,
      // The key is only for React; JSON drops it.
      blocks: blocks.map((block) => ({ ...block, key: undefined })),
    }),
    onSaved: (saved) => {
      form.clear();
      setTitle(saved.title);
    },
    onError: form.show,
  });

  const text = (value: Localised | undefined) => value?.[language] ?? "";
  const withText = (value: Localised | undefined, next: string): Localised => ({
    ...value,
    [language]: next,
  });
  const update = (key: number, patch: Partial<PageBlock>) => {
    setBlocks((current) =>
      current.map((block) => (block.key === key ? { ...block, ...patch } : block)),
    );
    draft.touch();
  };
  /** Positions change, so errors that point at them no longer do. */
  const restructure = (next: Block[]) => {
    setBlocks(next);
    form.clear();
    draft.touch();
  };
  const move = (index: number, by: -1 | 1) => {
    const next = [...blocks];
    const [block] = next.splice(index, 1);
    next.splice(index + by, 0, block!);
    restructure(next);
    setAnnouncement(t("moved", { position: index + by + 1, count: blocks.length }));
    // Keep focus on the same block's button, or its twin at either end of the list.
    const target = index + by;
    const end = by === -1 ? target === 0 : target === blocks.length - 1;
    focusField(form.fieldId(`blocks.${target}.${(by === -1) !== end ? "up" : "down"}`));
  };
  const add = (type: PageBlock["type"]) => {
    restructure([...blocks, { ...empty(type), key: nextKey.current++ }]);
    setAnnouncement(t("added", { type: t(`type.${type}`), position: blocks.length + 1 }));
    focusField(form.fieldId(`blocks.${blocks.length}`));
  };
  const remove = (index: number) => {
    restructure(blocks.filter((_, position) => position !== index));
    setAnnouncement(t("removed"));
    focusField(form.fieldId("add"));
  };

  const errorText = (path: string) => {
    const error = form.errorFor(path);
    return error ? forms(`error.${errorCode(error.message)}`) : undefined;
  };
  /** "Block 2 (Table), Header cell 1 (French)" from `blocks.1.rows.0.0.fr`. */
  const label = (path: string) => {
    const parts = path.split(".");
    const last = parts.at(-1)!;
    const inLanguage = (field: string) =>
      locales.includes(last) ? forms("fieldIn", { field, language: languageName(last) }) : field;
    if (parts[0] !== "blocks") return inLanguage(t("field.title"));
    const index = Number(parts[1]);
    const block = blocks[index];
    const where = t("blockN", {
      number: index + 1,
      type: block ? t(`type.${block.type}`) : "",
    });
    const field =
      parts[2] === "rows" && parts.length > 3
        ? t("field.headerCell", { number: Number(parts[4]) + 1 })
        : parts[2] === "partners" && parts.length > 3
          ? t(`field.partner${parts[4] === "url" ? "Url" : "Name"}`, {
              number: Number(parts[3]) + 1,
            })
          : t(`field.${parts[2] as "body"}`);
    return forms("errorIn", { where, field: inLanguage(field) });
  };
  const flagged = locales.filter((code) =>
    form.errors.some((error) => error.path.endsWith(`.${code}`)),
  );

  const field = (index: number, name: string) => form.fieldId(`blocks.${index}.${name}`);
  const localised = (index: number, name: string) => `blocks.${index}.${name}.${language}`;
  const required = language === defaultLocale && (
    <span className="text-muted-foreground ms-1 text-sm font-normal">{forms("required")}</span>
  );

  const bodyField = (block: Block, index: number) => {
    const path = localised(index, "body");
    return (
      <div>
        <label htmlFor={form.fieldId(path)} className="mb-1 block font-semibold">
          {t("field.body")}
          {required}
        </label>
        <textarea
          id={form.fieldId(path)}
          lang={language}
          className={`${AREA} ${block.type === "richText" ? "min-h-48" : ""} font-mono text-sm`}
          value={text(block.body)}
          aria-invalid={Boolean(form.errorFor(path))}
          aria-describedby={form.describedBy(path, `${field(index, "body")}-hint`)}
          onChange={(event) =>
            update(block.key, { body: withText(block.body, event.target.value) })
          }
        />
        <p id={`${field(index, "body")}-hint`} className="text-muted-foreground mt-1 text-sm">
          {t("hint.markdown")}
        </p>
        <FieldMessage id={`${form.fieldId(path)}-error`} text={errorText(path)} />
      </div>
    );
  };

  const imageFields = (block: Block, index: number) => {
    const path = localised(index, "alt");
    return (
      <div className="flex flex-col gap-4">
        <ImageField
          id={field(index, "src")}
          label={t("field.src")}
          value={block.src || undefined}
          onChange={(url) => update(block.key, { src: url ?? "" })}
          error={errorText(`blocks.${index}.src`)}
        />
        <div>
          <label htmlFor={form.fieldId(path)} className="mb-1 block font-semibold">
            {t("field.alt")}
            {required}
          </label>
          <input
            id={form.fieldId(path)}
            lang={language}
            className={FIELD}
            value={text(block.alt)}
            aria-invalid={Boolean(form.errorFor(path))}
            aria-describedby={form.describedBy(path, `${field(index, "alt")}-hint`)}
            onChange={(event) =>
              update(block.key, { alt: withText(block.alt, event.target.value) })
            }
          />
          <p id={`${field(index, "alt")}-hint`} className="text-muted-foreground mt-1 text-sm">
            {t("hint.alt")}
          </p>
          <FieldMessage id={`${form.fieldId(path)}-error`} text={errorText(path)} />
        </div>
      </div>
    );
  };

  const tableFields = (block: Block, index: number) => {
    const rows = block.rows ?? [];
    const columns = rows[0]?.length ?? 0;
    const setRows = (next: Localised[][]) => update(block.key, { rows: next });
    return (
      <div id={field(index, "rows")} tabIndex={-1} className="flex flex-col gap-3">
        <div
          className="relative overflow-x-auto"
          role="region"
          aria-label={t("field.rows")}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region
          tabIndex={0}
        >
          <table className="border-separate border-spacing-1">
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, column) => {
                    const path = `blocks.${index}.rows.${rowIndex}.${column}.${language}`;
                    const name =
                      rowIndex === 0
                        ? t("field.headerCell", { number: column + 1 })
                        : t("field.cell", { row: rowIndex, column: column + 1 });
                    return (
                      <td key={column} className="min-w-40 align-top">
                        <input
                          id={form.fieldId(path)}
                          lang={language}
                          aria-label={name}
                          className={`${FIELD} ${rowIndex === 0 ? "font-semibold" : ""}`}
                          value={text(cell)}
                          aria-invalid={Boolean(form.errorFor(path))}
                          aria-describedby={form.describedBy(path)}
                          onChange={(event) =>
                            setRows(
                              rows.map((line, r) =>
                                r === rowIndex
                                  ? line.map((item, c) =>
                                      c === column ? withText(item, event.target.value) : item,
                                    )
                                  : line,
                              ),
                            )
                          }
                        />
                        <FieldMessage id={`${form.fieldId(path)}-error`} text={errorText(path)} />
                      </td>
                    );
                  })}
                  <td className="align-top">
                    {rowIndex > 0 && rows.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("removeRow", { number: rowIndex })}
                        onClick={() => {
                          setRows(rows.filter((_, r) => r !== rowIndex));
                          focusField(field(index, "addRow"));
                        }}
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FieldMessage
          id={`${field(index, "rows")}-error`}
          text={errorText(`blocks.${index}.rows`)}
        />
        <p className="text-muted-foreground text-sm">{t("hint.table")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            id={field(index, "addRow")}
            type="button"
            variant="secondary"
            disabled={rows.length >= MAX_TABLE_ROWS}
            onClick={() => setRows([...rows, Array.from({ length: columns }, () => ({}))])}
          >
            {t("addRow")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={columns >= MAX_TABLE_COLUMNS}
            onClick={() => setRows(rows.map((row) => [...row, {}]))}
          >
            {t("addColumn")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={columns <= 1}
            onClick={() => setRows(rows.map((row) => row.slice(0, -1)))}
          >
            {t("removeColumn")}
          </Button>
        </div>
      </div>
    );
  };

  const partnerFields = (block: Block, index: number) => {
    const partners = block.partners ?? [];
    const setPartners = (next: Partner[]) => update(block.key, { partners: next });
    return (
      <div id={field(index, "partners")} tabIndex={-1} className="flex flex-col gap-3">
        <ul className="flex flex-col gap-3">
          {partners.map((partner, position) => {
            const namePath = `blocks.${index}.partners.${position}.name.${language}`;
            const urlPath = `blocks.${index}.partners.${position}.url`;
            return (
              <li key={position}>
                <fieldset className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <legend className="sr-only">{t("partnerN", { number: position + 1 })}</legend>
                  <div>
                    <label htmlFor={form.fieldId(namePath)} className="mb-1 block font-semibold">
                      {t("field.name")}
                      {required}
                    </label>
                    <input
                      id={form.fieldId(namePath)}
                      lang={language}
                      className={FIELD}
                      value={text(partner.name)}
                      aria-invalid={Boolean(form.errorFor(namePath))}
                      aria-describedby={form.describedBy(namePath)}
                      onChange={(event) =>
                        setPartners(
                          partners.map((item, p) =>
                            p === position
                              ? { ...item, name: withText(item.name, event.target.value) }
                              : item,
                          ),
                        )
                      }
                    />
                    <FieldMessage
                      id={`${form.fieldId(namePath)}-error`}
                      text={errorText(namePath)}
                    />
                  </div>
                  <div>
                    <label htmlFor={form.fieldId(urlPath)} className="mb-1 block font-semibold">
                      {t("field.url")}
                      <span className="text-muted-foreground ms-1 text-sm font-normal">
                        {forms("optional")}
                      </span>
                    </label>
                    <input
                      id={form.fieldId(urlPath)}
                      type="url"
                      inputMode="url"
                      className={FIELD}
                      value={partner.url ?? ""}
                      aria-invalid={Boolean(form.errorFor(urlPath))}
                      aria-describedby={form.describedBy(urlPath)}
                      onChange={(event) =>
                        setPartners(
                          partners.map((item, p) =>
                            p === position
                              ? { ...item, url: event.target.value || undefined }
                              : item,
                          ),
                        )
                      }
                    />
                    <FieldMessage id={`${form.fieldId(urlPath)}-error`} text={errorText(urlPath)} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="md:mt-7"
                    disabled={partners.length <= 1}
                    aria-label={t("removePartner", { number: position + 1 })}
                    onClick={() => {
                      setPartners(partners.filter((_, p) => p !== position));
                      focusField(field(index, "addPartner"));
                    }}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </fieldset>
              </li>
            );
          })}
        </ul>
        <FieldMessage
          id={`${field(index, "partners")}-error`}
          text={errorText(`blocks.${index}.partners`)}
        />
        <div>
          <Button
            id={field(index, "addPartner")}
            type="button"
            variant="secondary"
            onClick={() => setPartners([...partners, { name: {} }])}
          >
            <PlusIcon aria-hidden="true" />
            {t("addPartner")}
          </Button>
        </div>
      </div>
    );
  };

  const heading = initial.title[locale] || initial.title[defaultLocale] || initial.slug;
  const titlePath = `title.${language}`;

  return (
    <div className="mt-2 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-h1 min-w-0 break-words">{heading}</h1>
        <DraftBar
          draft={draft}
          portalHref={portalUrl(`/${locale}${PAGE_PATHS[initial.slug] ?? `/${initial.slug}`}`)}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <ErrorSummary
        ref={form.summary}
        title={forms("errorTitle", { count: form.errors.length })}
        items={form.errors.map((error) => {
          const code = error.path.split(".").at(-1)!;
          return {
            href: `#${form.fieldId(error.path)}`,
            text: forms("errorLine", {
              field: label(error.path),
              message: forms(`error.${errorCode(error.message)}`),
            }),
            onClick: () => {
              if (locales.includes(code)) setLanguage(code);
              focusField(form.fieldId(error.path));
            },
          };
        })}
      />
      <LanguageSwitch locales={locales} value={language} onChange={setLanguage} flagged={flagged} />

      <div className="max-w-xl">
        <label htmlFor={form.fieldId(titlePath)} className="mb-1 block font-semibold">
          {t("field.title")}
          {required}
        </label>
        <input
          id={form.fieldId(titlePath)}
          lang={language}
          className={FIELD}
          value={text(title)}
          aria-invalid={Boolean(form.errorFor(titlePath))}
          aria-describedby={form.describedBy(titlePath)}
          onChange={(event) => {
            setTitle(withText(title, event.target.value));
            draft.touch();
          }}
        />
        <FieldMessage id={`${form.fieldId(titlePath)}-error`} text={errorText(titlePath)} />
      </div>

      <section aria-labelledby={form.fieldId("blocks-title")}>
        <h2 id={form.fieldId("blocks-title")} className="text-h2">
          {t("blocks")}
        </h2>
        {blocks.length === 0 && <p className="text-muted-foreground mt-2">{t("noBlocks")}</p>}
        <ol className="mt-3 flex flex-col gap-4">
          {blocks.map((block, index) => (
            <li key={block.key}>
              <fieldset
                id={form.fieldId(`blocks.${index}`)}
                tabIndex={-1}
                className="min-w-0 rounded-lg border p-4"
              >
                <legend className="px-1 font-semibold">
                  {t("blockN", { number: index + 1, type: t(`type.${block.type}`) })}
                </legend>
                <div className="mb-3 flex flex-wrap justify-end gap-1">
                  <Button
                    id={field(index, "up")}
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    aria-label={t("moveUp", { number: index + 1 })}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpIcon aria-hidden="true" />
                  </Button>
                  <Button
                    id={field(index, "down")}
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === blocks.length - 1}
                    aria-label={t("moveDown", { number: index + 1 })}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownIcon aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeBlock", { number: index + 1 })}
                    onClick={() => remove(index)}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </div>
                {(block.type === "richText" || block.type === "callout") && bodyField(block, index)}
                {block.type === "image" && imageFields(block, index)}
                {block.type === "table" && tableFields(block, index)}
                {block.type === "partners" && partnerFields(block, index)}
              </fieldset>
            </li>
          ))}
        </ol>
        <div
          id={form.fieldId("add")}
          tabIndex={-1}
          role="group"
          aria-labelledby={form.fieldId("add-label")}
          className="mt-4"
        >
          <p id={form.fieldId("add-label")} className="mb-2 font-semibold">
            {t("addBlock")}
          </p>
          <div className="flex flex-wrap gap-2">
            {BLOCK_TYPES.map((type) => (
              <Button key={type} type="button" variant="secondary" onClick={() => add(type)}>
                <PlusIcon aria-hidden="true" />
                {t(`type.${type}`)}
              </Button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
