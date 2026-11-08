import { getLocale, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { getExplorerTree } from "@/lib/explorer";
import { ExplorerRail } from "./explorer-rail";

/** Rail plus main column for `/data` and `/data/[code]` (brief §5.2). */
export async function ExplorerFrame({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const [tree, t, common] = await Promise.all([
    getExplorerTree(locale),
    getTranslations("Explorer"),
    getTranslations("Common"),
  ]);
  const counts: Record<string, string> = {};
  for (const pillar of tree) {
    counts[pillar.code] = t("count", { count: pillar.count });
    for (const theme of pillar.themes) {
      counts[`${pillar.code}/${theme.code}`] = t("count", { count: theme.indicators.length });
    }
  }
  return (
    <div className="onn-container lg:flex lg:items-start lg:gap-8">
      <Suspense>
        <ExplorerRail
          tree={tree}
          browse={t("browse")}
          close={common("close")}
          labels={{
            tree: t("tree"),
            filter: t("filter"),
            noMatches: t.raw("noMatches") as string,
            counts,
          }}
        />
      </Suspense>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
