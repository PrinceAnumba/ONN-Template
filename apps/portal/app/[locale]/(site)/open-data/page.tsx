import { api, serverCache } from "@onn/api-client";
import type { Dataset } from "@onn/api-client/types";
import { Button } from "@onn/ui/components/ui/button";
import { cn } from "@onn/ui/lib/utils";
import { CodeIcon, DatabaseIcon, DownloadIcon, FileJsonIcon } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";

const FULL_DUMP = "ALL";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("openData") };
}

async function DatasetCard({ dataset, featured }: { dataset: Dataset; featured?: boolean }) {
  const [t, locale] = await Promise.all([getTranslations("OpenData"), getLocale()]);
  // The full dump sits directly under the h1; pillar cards sit under "By pillar".
  const Heading = featured ? "h2" : "h3";
  const facts = [
    [t("licence"), dataset.licence],
    [t("frequency"), dataset.updateFrequency],
    [t("updated"), formatDate(dataset.lastUpdated, locale)],
  ] as const;
  return (
    <article
      aria-labelledby={`ds-${dataset.code}`}
      className={cn(
        "flex h-full flex-col gap-3 rounded-lg border p-5",
        featured ? "bg-surface-2 border-primary border-2" : "bg-card",
      )}
    >
      <div className="flex items-start gap-3">
        <DatabaseIcon aria-hidden className="text-primary mt-1 size-5 shrink-0" />
        <div className="min-w-0">
          <Heading id={`ds-${dataset.code}`} className={featured ? "text-h3" : "text-h4"}>
            {dataset.title}
          </Heading>
          <p className="text-muted-foreground mt-1 text-sm">{dataset.description}</p>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-auto flex flex-wrap gap-2 pt-2" aria-label={t("downloads")}>
        {dataset.formats.map((format) => (
          <li key={format}>
            <Button asChild variant={featured ? "primary" : "secondary"} size="sm" className="h-11">
              <a
                href={`${dataset.url}?format=${format.toLowerCase()}`}
                download
                aria-label={t("downloadAs", { format, title: dataset.title })}
              >
                <DownloadIcon aria-hidden />
                {format}
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Open data (brief §5.9): the full dump, a dataset per pillar, and the DCAT catalogue. */
export default async function OpenDataPage() {
  const locale = await getLocale();
  const [t, nav] = await Promise.all([getTranslations("OpenData"), getTranslations("Nav")]);
  let datasets: Dataset[] | null = null;
  try {
    datasets = await api.datasets({ locale, next: serverCache("datasets") });
  } catch {
    datasets = null;
  }
  const dump = datasets?.find((item) => item.code === FULL_DUMP);
  const pillars = datasets?.filter((item) => item.code !== FULL_DUMP) ?? [];

  return (
    <main id="content" className="onn-container py-8">
      <h1>{nav("openData")}</h1>
      <p className="text-muted-foreground mt-2 max-w-prose">{t("intro")}</p>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <li>
          <a
            href={`/${locale}/open-data/catalog.jsonld`}
            className="text-primary inline-flex min-h-11 items-center gap-2 font-semibold underline"
          >
            <FileJsonIcon aria-hidden className="size-5" />
            {t("catalog")}
          </a>
        </li>
        <li>
          <Link
            href="/developers"
            className="text-primary inline-flex min-h-11 items-center gap-2 font-semibold underline"
          >
            <CodeIcon aria-hidden className="size-5" />
            {t("api")}
          </Link>
        </li>
      </ul>

      {!datasets ? (
        <p role="alert" className="bg-surface-2 mt-6 rounded-lg p-6">
          {t("error")}
        </p>
      ) : (
        <>
          {dump && (
            <div className="mt-6 max-w-3xl">
              <DatasetCard dataset={dump} featured />
            </div>
          )}
          <h2 className="mt-10">{t("byPillar")}</h2>
          <ul className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pillars.map((dataset) => (
              <li key={dataset.code}>
                <DatasetCard dataset={dataset} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
