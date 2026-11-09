import { ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportWizard } from "@/components/imports/import-wizard";
import { requireSession } from "@/lib/session";

interface ImportProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ImportProps) {
  return { title: decodeURIComponent((await params).id) };
}

/** Import wizard, steps 2–4 (brief §7). The job id is in the path, so a reload resumes it. */
export default async function ImportPage({ params }: ImportProps) {
  const { id } = await params;
  const session = await requireSession();
  const t = await getTranslations("Admin.imports");
  const job = await adminApi
    .importJob({ locale: await getLocale(), token: session.token }, decodeURIComponent(id))
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });

  return (
    <>
      <Link href="/imports" className="text-sm underline">
        {t("back")}
      </Link>
      <h1 className="text-h1 mt-3 break-words">{t("jobTitle", { file: job.fileName })}</h1>
      <p className="text-muted-foreground mt-1">{t("jobMeta", { id: job.id, org: job.orgName })}</p>
      <ImportWizard initial={job} />
    </>
  );
}
