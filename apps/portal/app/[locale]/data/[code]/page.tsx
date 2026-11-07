import { ApiError, api, serverCache } from "@onn/api-client";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export default async function IndicatorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const locale = await getLocale();
  const indicator = await api
    .indicator({ locale, next: serverCache(`indicator:${code}`) }, decodeURIComponent(code))
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });
  return <PlaceholderPage title={indicator.name} />;
}
