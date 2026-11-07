import { getLocale } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense, type ReactNode } from "react";
import { getSelectorData } from "@/lib/selector-data";
import { SelectorBar } from "./selector-bar";

/**
 * Selector bar plus URL state, for the routes in brief §4.2. Each route has its own one-line
 * layout: a shared (data) route group would pull this code into every page, home included.
 */
export async function DataShell({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const data = await getSelectorData(locale);
  return (
    <NuqsAdapter>
      <Suspense>
        <SelectorBar data={data} />
      </Suspense>
      {children}
    </NuqsAdapter>
  );
}
