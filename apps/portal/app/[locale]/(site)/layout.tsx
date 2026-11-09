import { isMockMode } from "@onn/api-client";
import { country } from "@onn/config";
import { DemoRibbon } from "@onn/ui/components/demo-ribbon";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/shell/site-footer";
import { OfflineStatus } from "@/components/shell/offline-status";
import { RoutePending } from "@/components/shell/route-pending";
import { SiteHeader } from "@/components/shell/site-header";

/** Header and footer for every page except embeds. A server layout, so it adds no client code. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [t, meta] = await Promise.all([getTranslations("Common"), getTranslations("Meta")]);
  return (
    <>
      <a
        href="#content"
        className="bg-background sr-only rounded-md p-3 focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50"
      >
        {t("skipToContent")}
      </a>
      {isMockMode && <DemoRibbon label={t("demoData")} />}
      {meta("status") === "placeholder" && (
        // Placeholder catalogues (e.g. Wolof before review) are visibly marked (spec decision).
        // The notice is written in the language the placeholder text is in.
        <p role="note" lang={country.locales.default} className="bg-surface-2 border-b text-sm">
          <span className="onn-container block py-2">{meta("notice")}</span>
        </p>
      )}
      <OfflineStatus locale={await getLocale()} />
      <SiteHeader />
      <div className="flex-1">
        <RoutePending label={t("loadingPage")}>{children}</RoutePending>
      </div>
      <SiteFooter />
    </>
  );
}
