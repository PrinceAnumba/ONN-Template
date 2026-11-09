import { can } from "@onn/api-client/permissions";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConnectorForm } from "@/components/connectors/connector-form";
import { requireSession } from "@/lib/session";

export async function generateMetadata() {
  return { title: (await getTranslations("Admin.connectors"))("newTitle") };
}

/** New connector: test the source first, then map its fields and save. */
export default async function NewConnectorPage() {
  const session = await requireSession();
  if (!can(session.roles, "connector.manage")) notFound();
  const t = await getTranslations("Admin.connectors");
  return (
    <>
      <Link href="/connectors" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <h1 className="text-h1">{t("newTitle")}</h1>
      <p className="text-muted-foreground mt-1 max-w-2xl">{t("newIntro")}</p>
      <ConnectorForm
        orgs={session.orgs.map((org) => ({ code: org.code, name: org.name }))}
        defaultOrg={session.activeOrg ?? session.orgs[0]?.code ?? ""}
        canManage
      />
    </>
  );
}
