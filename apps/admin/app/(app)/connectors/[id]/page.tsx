import { ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { can } from "@onn/api-client/permissions";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConnectorForm } from "@/components/connectors/connector-form";
import { RunHistory } from "@/components/connectors/run-history";
import { requireSession } from "@/lib/session";

interface ConnectorProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ConnectorProps) {
  return { title: decodeURIComponent((await params).id) };
}

/** Connector detail (brief §7): settings, field mapping, test, dry run, run history. */
export default async function ConnectorPage({ params }: ConnectorProps) {
  const id = decodeURIComponent((await params).id);
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.connectors");
  const connector = await adminApi
    .connector({ locale, token: session.token }, id)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });

  return (
    <>
      <Link href="/connectors" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <h1 className="text-h1">{connector.name}</h1>
      <p className="text-muted-foreground mt-1">
        {t("subtitle", { type: t(`type.${connector.type}`), org: connector.orgName })}
      </p>
      <ConnectorForm
        initial={connector}
        orgs={session.orgs.map((org) => ({ code: org.code, name: org.name }))}
        defaultOrg={connector.org}
        canManage={can(session.roles, "connector.manage")}
      />
      <RunHistory runs={connector.runs} />
    </>
  );
}
