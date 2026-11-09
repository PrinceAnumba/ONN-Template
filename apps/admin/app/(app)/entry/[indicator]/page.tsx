import { ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryEditor } from "@/components/entry/entry-editor";
import { requireSession } from "@/lib/session";

interface EntryProps {
  params: Promise<{ indicator: string }>;
  searchParams: Promise<{ period?: string }>;
}

export async function generateMetadata({ params }: EntryProps) {
  return { title: decodeURIComponent((await params).indicator) };
}

/** Manual data entry (brief §7): one indicator, areas × periods, saved as an entry draft. */
export default async function EntryPage({ params, searchParams }: EntryProps) {
  const { indicator } = await params;
  const { period } = await searchParams;
  const session = await requireSession();
  const t = await getTranslations("Admin.entry");
  const sheet = await adminApi
    .entrySheet(
      { locale: await getLocale(), token: session.token },
      decodeURIComponent(indicator),
      period,
    )
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });
  const target = sheet.periods.at(-1)!;

  return (
    <>
      <Link href="/entry" className="text-sm underline">
        {t("back")}
      </Link>
      <h1 className="text-h1 mt-3">{sheet.indicator.name}</h1>
      <p className="text-muted-foreground mt-1">
        {t("sheetMeta", {
          code: sheet.indicator.code,
          org: sheet.orgName,
          unit: sheet.indicator.unit,
          period: target,
        })}
      </p>
      {/* Keyed by period so switching periods starts a fresh editor. */}
      <EntryEditor key={target} sheet={sheet} />
    </>
  );
}
