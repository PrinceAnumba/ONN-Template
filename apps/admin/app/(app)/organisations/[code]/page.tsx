import { ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { country } from "@onn/config";
import { StatusPill } from "@onn/ui/components/status-pill";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrganisationForm } from "@/components/organisations/organisation-form";
import { formatDate } from "@/lib/format";
import { USER_TONE } from "@/lib/governance";
import { requireSession } from "@/lib/session";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const t = await getTranslations("Admin.organisations");
  return { title: t("detailTitle", { code: (await params).code }) };
}

const LINKED = "flex flex-col divide-y rounded-lg border";
const ROW_LINK = "inline-flex min-h-11 items-center underline";

/** One organisation (brief §7): profile and contacts, then what it reports and who works on it. */
export default async function OrganisationPage({ params }: PageProps) {
  const { code } = await params;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.organisations");
  const users = await getTranslations("Admin.users");
  const roles = await getTranslations("Admin.roles");
  const org = await adminApi
    .organisation({ locale, token: session.token }, code)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });
  const name = org.name[locale] || org.name[country.locales.default] || org.code;
  return (
    <>
      <Link href="/organisations" className={ROW_LINK}>
        {t("back")}
      </Link>
      <h1 className="text-h1">{name}</h1>
      <p className="text-muted-foreground mt-1 mb-6">
        {org.updated
          ? t("codeUpdated", { code: org.code, date: formatDate(org.updated, locale, "medium") })
          : org.code}
      </p>
      <OrganisationForm
        key={org.updated}
        initial={org}
        locales={country.locales.enabled}
        defaultLocale={country.locales.default}
      />

      <section aria-labelledby="org-indicators" className="mt-10 max-w-3xl">
        <h2 id="org-indicators" className="text-h3">
          {t("indicators", { count: org.indicators.length })}
        </h2>
        <p className="text-muted-foreground mt-1 mb-3 text-sm">{t("indicatorsHelp")}</p>
        {org.indicators.length === 0 ? (
          <p>{t("noIndicators")}</p>
        ) : (
          <ul className={LINKED}>
            {org.indicators.map((item) => (
              <li key={item.code} className="flex flex-wrap items-center gap-x-3 px-3 py-1">
                <Link href={`/indicators/${item.code}`} className={ROW_LINK}>
                  {item.name}
                </Link>
                <span className="text-muted-foreground text-sm">{item.code}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="org-connectors" className="mt-10 max-w-3xl">
        <h2 id="org-connectors" className="text-h3 mb-3">
          {t("connectors", { count: org.connectors.length })}
        </h2>
        {org.connectors.length === 0 ? (
          <p>{t("noConnectors")}</p>
        ) : (
          <ul className={LINKED}>
            {org.connectors.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-x-3 px-3 py-1"
              >
                <Link href={`/connectors/${item.id}`} className={ROW_LINK}>
                  {item.name}
                </Link>
                <StatusPill
                  tone={item.lastStatus === "ok" ? "positive" : "negative"}
                  label={t(item.lastStatus === "ok" ? "runOk" : "runFailed", {
                    date: formatDate(item.lastRun, locale, "medium"),
                  })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="org-users" className="mt-10 max-w-3xl">
        <h2 id="org-users" className="text-h3 mb-3">
          {t("users", { count: org.users.length })}
        </h2>
        {org.users.length === 0 ? (
          <p>{t("noUsers")}</p>
        ) : (
          <ul className={LINKED}>
            {org.users.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-x-3 px-3 py-1"
              >
                <span className="flex flex-wrap items-center gap-x-3">
                  <Link href={`/users/${item.id}`} className={ROW_LINK}>
                    {item.name}
                  </Link>
                  <span className="text-muted-foreground text-sm">
                    {item.roles.map((role) => roles(role)).join(", ")}
                  </span>
                </span>
                <StatusPill tone={USER_TONE[item.status]} label={users(`status.${item.status}`)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
