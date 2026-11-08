import { api, serverCache } from "@onn/api-client";
import type { Dashboard } from "@onn/api-client/types";
import { cn } from "@onn/ui/lib/utils";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { createLoader, parseAsStringLiteral, type SearchParams } from "nuqs/server";
import { DashboardCard, dashboardThumbnail } from "@/components/dashboard/dashboard-card";
import { Link } from "@/i18n/navigation";

const AUDIENCES = ["decision", "analyst", "public"] as const;
const loadParams = createLoader({ audience: parseAsStringLiteral(AUDIENCES) });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return { title: t("dashboards") };
}

/** Dashboard index (brief §5.5): cards as on home, filtered by audience with plain links. */
export default async function DashboardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const ctx = { locale, next: serverCache("dashboards") };
  const [{ audience }, t, home, pages] = await Promise.all([
    loadParams(searchParams),
    getTranslations("Dashboard"),
    getTranslations("Home"),
    getTranslations("Pages"),
  ]);
  let dashboards: Dashboard[] = [];
  let failed = false;
  try {
    dashboards = await api.dashboards(ctx);
  } catch {
    failed = true;
  }
  const shown = dashboards.filter((item) => !audience || item.audience === audience);
  const cards = await Promise.all(
    shown.map(async (dashboard) => ({
      dashboard,
      thumbnail: await dashboardThumbnail(dashboard, ctx),
    })),
  );
  const filters = [
    { value: null, label: t("all") },
    ...AUDIENCES.map((value) => ({ value, label: home(`audience.${value}`) })),
  ];

  return (
    <main id="content" className="onn-container py-8">
      <h1>{pages("dashboards")}</h1>
      <p className="text-muted-foreground mt-2 max-w-prose">{t("intro")}</p>
      <nav aria-label={t("audienceFilter")} className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const active = filter.value === audience;
            return (
              <li key={filter.label}>
                <Link
                  href={filter.value ? `/dashboards?audience=${filter.value}` : "/dashboards"}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-pill flex min-h-11 items-center border px-4 text-sm",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-surface-2",
                  )}
                >
                  {filter.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {failed ? (
        <p role="alert" className="bg-surface-2 mt-8 rounded-lg p-6">
          {t("widgetError")}
        </p>
      ) : cards.length ? (
        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {cards.map(({ dashboard, thumbnail }) => (
            <li key={dashboard.slug}>
              <DashboardCard
                dashboard={dashboard}
                thumbnail={thumbnail}
                audience={home(`audience.${dashboard.audience}`)}
                heading="h2"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-8">{t("noDashboards")}</p>
      )}
    </main>
  );
}
