import { adminApi } from "@onn/api-client/admin";
import { country } from "@onn/config";
import { tagFor } from "@onn/config/locale";
import { EmptyState } from "@onn/ui/components/empty-state";
import { StatusPill } from "@onn/ui/components/status-pill";
import { MailIcon, UsersIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  FILTER_FIELD,
  listHref,
  ListPager,
  PrimaryLink,
  TabLinks,
  TableFrame,
} from "@/components/list";
import { CAMPAIGN_TONE } from "@/lib/editorial";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { PAGE_SIZES } from "@/lib/submissions";

interface NewsletterProps {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    locale?: string;
    status?: string;
    page?: string;
    size?: string;
  }>;
}

/** Newsletter (brief §7): drafts and past sends with their rates, and the subscriber list. */
export default async function NewsletterPage({ searchParams }: NewsletterProps) {
  const params = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.newsletter");
  const forms = await getTranslations("Admin.forms");
  const common = await getTranslations("Common");
  const ctx = { locale, token: session.token };
  const showSubscribers = params.tab === "subscribers";
  const create = <PrimaryLink href="/newsletter/new">{t("new")}</PrimaryLink>;
  const pageSize = PAGE_SIZES.find((size) => String(size) === params.size) ?? PAGE_SIZES[0]!;
  const language = country.locales.enabled.find((code) => code === params.locale);
  const status =
    params.status === "active" || params.status === "unsubscribed" ? params.status : undefined;
  const [campaigns, subscribers, options] = await Promise.all([
    showSubscribers ? null : adminApi.campaigns(ctx),
    showSubscribers
      ? adminApi.subscribers(ctx, {
          q: params.q?.trim() || undefined,
          locale: language,
          status,
          page: Number(params.page) || 1,
          pageSize,
        })
      : null,
    showSubscribers ? adminApi.campaignOptions(ctx) : null,
  ]);
  const rate = (value: number | null) =>
    value === null
      ? "—"
      : formatNumber(value, locale, { style: "percent", maximumFractionDigits: 1 });
  const stamp = (value: string) =>
    forms("dateTime", {
      date: formatDate(value, locale, "medium"),
      time: formatTime(value, locale),
    });
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([tagFor(locale)], { type: "language" });
  } catch {
    names = null;
  }
  const languageName = (code: string) => names?.of(code) ?? code.toUpperCase();
  const topicName = (code: string) =>
    options?.topics.find((topic) => topic.code === code)?.name ?? code;
  const filtered = Boolean(params.q?.trim() || language || status);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-h1">{t("title")}</h1>
        {create}
      </div>
      <TabLinks
        label={t("tabsLabel")}
        tabs={[
          { href: "/newsletter", label: t("tab.campaigns"), active: !showSubscribers },
          {
            href: "/newsletter?tab=subscribers",
            label: t("tab.subscribers"),
            active: showSubscribers,
          },
        ]}
      />

      {campaigns && (
        <div className="mt-6">
          {campaigns.length === 0 ? (
            <EmptyState icon={MailIcon} message={t("empty")} action={create} />
          ) : (
            <TableFrame
              label={t("tab.campaigns")}
              columns={(
                ["subject", "status", "date", "recipients", "openRate", "clickRate"] as const
              ).map((key) => t(`column.${key}`))}
            >
              {campaigns.map((item) => (
                <tr key={item.id} className="border-t align-top">
                  <th scope="row" className="min-w-56 p-3 text-start font-semibold">
                    <Link href={`/newsletter/${item.id}`} className="underline">
                      {item.subject}
                    </Link>
                  </th>
                  <td className="p-3">
                    <StatusPill
                      tone={CAMPAIGN_TONE[item.status]}
                      label={t(`status.${item.status}`)}
                    />
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {item.sentAt
                      ? stamp(item.sentAt)
                      : item.sendAt
                        ? t("scheduledFor", { when: stamp(item.sendAt) })
                        : t("editedOn", { date: formatDate(item.updated, locale, "medium") })}
                  </td>
                  <td className="p-3 tabular-nums">{formatNumber(item.recipients, locale)}</td>
                  <td className="p-3 tabular-nums">{rate(item.openRate)}</td>
                  <td className="p-3 tabular-nums">{rate(item.clickRate)}</td>
                </tr>
              ))}
            </TableFrame>
          )}
        </div>
      )}

      {subscribers && (
        <>
          <form
            action="/admin/newsletter"
            method="get"
            className="mt-6 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="tab" value="subscribers" />
            <div>
              <label htmlFor="subscriber-q" className="mb-1 block font-semibold">
                {t("filter.search")}
              </label>
              <input
                id="subscriber-q"
                name="q"
                type="search"
                defaultValue={params.q ?? ""}
                className={`${FILTER_FIELD} w-64 max-w-full`}
              />
            </div>
            <div>
              <label htmlFor="subscriber-locale" className="mb-1 block font-semibold">
                {t("filter.locale")}
              </label>
              <select
                id="subscriber-locale"
                name="locale"
                defaultValue={language ?? ""}
                className={FILTER_FIELD}
              >
                <option value="">{forms("all")}</option>
                {country.locales.enabled.map((code) => (
                  <option key={code} value={code}>
                    {languageName(code)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="subscriber-status" className="mb-1 block font-semibold">
                {t("filter.status")}
              </label>
              <select
                id="subscriber-status"
                name="status"
                defaultValue={status ?? ""}
                className={FILTER_FIELD}
              >
                <option value="">{forms("all")}</option>
                <option value="active">{t("subscriber.active")}</option>
                <option value="unsubscribed">{t("subscriber.unsubscribed")}</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-primary text-primary-foreground h-11 rounded-md px-4 font-semibold"
            >
              {common("apply")}
            </button>
            {filtered && (
              <Link
                href="/newsletter?tab=subscribers"
                className="inline-flex h-11 items-center underline"
              >
                {forms("clearFilters")}
              </Link>
            )}
          </form>
          <p role="status" className="text-muted-foreground mt-4">
            {t("subscriberCount", { count: subscribers.meta.total })}
          </p>
          <div className="mt-2">
            {subscribers.items.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                message={t(filtered ? "noSubscribersFiltered" : "noSubscribers")}
              />
            ) : (
              <TableFrame
                label={t("tab.subscribers")}
                columns={(["email", "locale", "topics", "status", "since"] as const).map((key) =>
                  t(`subscriberColumn.${key}`),
                )}
              >
                {subscribers.items.map((item) => (
                  <tr key={item.email} className="border-t align-top">
                    <th scope="row" className="p-3 text-start font-semibold break-all">
                      {item.email}
                    </th>
                    <td className="p-3 whitespace-nowrap">{languageName(item.locale)}</td>
                    <td className="min-w-48 p-3">
                      {item.topics.length ? item.topics.map(topicName).join(", ") : t("allTopics")}
                    </td>
                    <td className="p-3">
                      <StatusPill
                        tone={item.status === "active" ? "positive" : "neutral"}
                        label={t(`subscriber.${item.status}`)}
                      />
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {formatDate(item.since, locale, "medium")}
                    </td>
                  </tr>
                ))}
              </TableFrame>
            )}
          </div>
          <ListPager
            meta={subscribers.meta}
            href={({ page, size }) =>
              listHref("/newsletter", {
                tab: "subscribers",
                q: params.q?.trim(),
                locale: language,
                status,
                size,
                page,
              })
            }
          />
        </>
      )}
    </>
  );
}
