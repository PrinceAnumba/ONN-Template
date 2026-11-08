import { ApiError, api, serverCache } from "@onn/api-client";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const dashboard = await api
    .dashboard({ locale, next: serverCache(`dashboard:${slug}`) }, slug)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });
  return <PlaceholderPage title={dashboard.title} />;
}
