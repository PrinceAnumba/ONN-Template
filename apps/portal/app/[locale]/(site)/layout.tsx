import { isMockMode } from "@onn/api-client";
import { DemoRibbon } from "@onn/ui/components/demo-ribbon";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/shell/site-footer";
import { RoutePending } from "@/components/shell/route-pending";
import { SiteHeader } from "@/components/shell/site-header";

/** Header and footer for every page except embeds. A server layout, so it adds no client code. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Common");
  return (
    <>
      <a
        href="#content"
        className="bg-background sr-only rounded-md p-3 focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50"
      >
        {t("skipToContent")}
      </a>
      {isMockMode && <DemoRibbon label={t("demoData")} />}
      <SiteHeader />
      <div className="flex-1">
        <RoutePending label={t("loadingPage")}>{children}</RoutePending>
      </div>
      <SiteFooter />
    </>
  );
}
