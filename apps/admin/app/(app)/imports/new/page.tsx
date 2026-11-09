import { isMockMode } from "@onn/api-client";
import { can } from "@onn/api-client/permissions";
import { StatusStepper } from "@onn/ui/components/status-stepper";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UploadForm } from "@/components/imports/upload-form";
import { WIZARD_STEPS } from "@/lib/imports";
import { requireSession } from "@/lib/session";

export async function generateMetadata() {
  return { title: (await getTranslations("Admin.imports"))("new") };
}

/** Import wizard, step 1 (brief §7): choose the organisation, download a template, upload. */
export default async function NewImportPage() {
  const session = await requireSession();
  if (!can(session.roles, "submission.submit")) notFound();
  const t = await getTranslations("Admin.imports");

  return (
    <>
      <Link href="/imports" className="text-sm underline">
        {t("back")}
      </Link>
      <h1 className="text-h1 mt-3">{t("new")}</h1>
      <StatusStepper
        className="mt-6"
        steps={WIZARD_STEPS.map((step) => t(`step.${step}`))}
        current={0}
        label={t("progress")}
        doneLabel={t("stepDone")}
        currentLabel={t("stepCurrent")}
      />
      <UploadForm
        orgs={session.orgs.map((org) => ({ code: org.code, name: org.name }))}
        defaultOrg={session.activeOrg ?? (session.orgs.length === 1 ? session.orgs[0]!.code : "")}
        demo={isMockMode}
      />
    </>
  );
}
