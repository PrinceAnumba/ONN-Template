import { ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { StatusPill } from "@onn/ui/components/status-pill";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertForm } from "@/components/alerts/alert-form";
import { formatDate } from "@/lib/format";
import { pickerData } from "@/lib/picker-data";
import { requireSession } from "@/lib/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const t = await getTranslations("Admin.alerts");
  return { title: t("detailTitle", { id: (await params).id }) };
}

/** One alert rule, with a link to what it has sent (brief §7). */
export default async function AlertPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.alerts");
  const ctx = { locale, token: session.token };
  const [rule, { people }, picker] = await Promise.all([
    adminApi.alert(ctx, id).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    adminApi.alerts(ctx),
    pickerData(locale),
  ]);
  return (
    <>
      <Link href="/alerts" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <h1 className="text-h1 break-words">{rule.name}</h1>
      <div className="mt-2 mb-6 flex flex-wrap items-center gap-3">
        <StatusPill
          tone={rule.enabled ? "positive" : "neutral"}
          label={t(rule.enabled ? "enabled" : "paused")}
        />
        <span className="text-sm">
          {rule.lastTriggered
            ? t("lastTriggered", { date: formatDate(rule.lastTriggered, locale, "medium") })
            : t("neverTriggered")}
        </span>
        <Link
          href={`/alerts?tab=events&rule=${rule.id}`}
          className="inline-flex min-h-11 items-center underline"
        >
          {t("viewEvents")}
        </Link>
      </div>
      <AlertForm initial={rule} people={people} indicators={picker.indicators} />
    </>
  );
}
