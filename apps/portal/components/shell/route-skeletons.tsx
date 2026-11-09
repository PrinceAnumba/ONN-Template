import { ChartSkeleton, KpiSkeleton, Skeleton, TableSkeleton } from "@onn/ui/components/skeleton";
import type { ReactNode } from "react";

// Loaded on the first client navigation only (see route-pending.tsx), so no page ships it up front.
// Each layout mirrors its route's page: same container, padding and grid.

function SelectorBar() {
  return (
    <div className="bg-surface-2 py-3">
      <div className="onn-container">
        <Skeleton className="h-11 w-full md:h-[68px]" />
      </div>
    </div>
  );
}

function Title({ width = "w-72" }: { width?: string }) {
  return <Skeleton className={`h-9 max-w-full ${width}`} />;
}

function Page({ children }: { children: ReactNode }) {
  return <div className="onn-container py-8">{children}</div>;
}

function Explorer({ children }: { children: ReactNode }) {
  return (
    <>
      <SelectorBar />
      <div className="onn-container lg:flex lg:items-start lg:gap-8">
        <div className="hidden w-72 shrink-0 py-6 pe-2 lg:block">
          {Array.from({ length: 8 }, (_, row) => (
            <Skeleton key={row} className="mb-3 h-6 w-full" />
          ))}
        </div>
        <div className="min-w-0 flex-1 py-6 lg:py-8">{children}</div>
      </div>
    </>
  );
}

function CardGrid({ count = 6, height = "h-64" }: { count?: number; height?: string }) {
  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, card) => (
        <Skeleton key={card} className={`w-full ${height}`} />
      ))}
    </div>
  );
}

const indicator = (
  <Explorer>
    <Title width="w-96" />
    <Skeleton className="mt-3 h-4 w-1/2" />
    <div className="mt-6 grid gap-10 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <ChartSkeleton />
      <div className="space-y-4">
        <KpiSkeleton />
      </div>
    </div>
  </Explorer>
);

const profile = (
  <Explorer>
    <Title width="w-96" />
    <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, card) => (
        <KpiSkeleton key={card} />
      ))}
    </div>
  </Explorer>
);

const map = (
  <>
    <SelectorBar />
    <Skeleton className="h-[70dvh] w-full rounded-none" />
  </>
);

const dashboard = (
  <>
    <SelectorBar />
    <Page>
      <Skeleton className="h-4 w-24" />
      <div className="mt-2">
        <Title width="w-96" />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <ChartSkeleton className="md:col-span-2" />
        <ChartSkeleton />
      </div>
    </Page>
  </>
);

const dashboards = (
  <>
    <SelectorBar />
    <Page>
      <Title />
      <CardGrid count={3} height="h-80" />
    </Page>
  </>
);

const benchmark = (
  <>
    <SelectorBar />
    <Page>
      <Title />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton className="mt-10" />
    </Page>
  </>
);

const query = (
  <Page>
    <Title />
    <div className="mt-6 grid items-start gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Skeleton className="h-96 w-full" />
      <TableSkeleton />
    </div>
  </Page>
);

const catalogue = (
  <Page>
    <Title />
    <Skeleton className="mt-6 h-11 w-full" />
    <TableSkeleton className="mt-6" />
  </Page>
);

const listing = (
  <Page>
    <Title />
    <Skeleton className="mt-6 h-24 w-full" />
    <CardGrid />
  </Page>
);

const article = (
  <Page>
    <Title width="w-[32rem]" />
    <div className="mt-6 max-w-prose space-y-3">
      {Array.from({ length: 8 }, (_, line) => (
        <Skeleton key={line} className={line % 3 === 2 ? "h-4 w-2/3" : "h-4 w-full"} />
      ))}
    </div>
  </Page>
);

const home = (
  <>
    <div className="bg-surface-2 pt-10 pb-8 md:pt-16 md:pb-12">
      <div className="onn-container">
        <Skeleton className="h-12 w-full max-w-3xl" />
        <Skeleton className="mt-3 h-6 w-2/3" />
        <Skeleton className="mt-8 h-[68px] w-full" />
      </div>
    </div>
    <div className="onn-container grid gap-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, card) => (
        <KpiSkeleton key={card} />
      ))}
    </div>
  </>
);

/** Picks the skeleton for a path without its locale prefix, e.g. `/data/CONN.4G_POP`. */
export function skeletonFor(path: string): ReactNode {
  const [section, detail] = path.split("/").filter(Boolean);
  switch (section) {
    case undefined:
      return home;
    case "data":
      return detail ? indicator : profile;
    case "map":
      return map;
    case "dashboards":
      return detail ? dashboard : dashboards;
    case "benchmark":
      return benchmark;
    case "query":
      return query;
    case "catalogue":
      return catalogue;
    case "publications":
    case "news":
      return detail ? article : listing;
    default:
      return article;
  }
}
