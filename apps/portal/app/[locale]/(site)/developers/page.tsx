import { country } from "@onn/config";
import { FileJsonIcon } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ApiReference } from "@/components/developers/api-reference";
import { ApiKeyForm } from "@/components/forms/api-key-form";
import { CodePanel } from "@/components/query/code-panel";
import { ClientMessages } from "@/components/shell/client-messages";
import { tagFor } from "@/lib/format";
import { siteOrigin } from "@/lib/origin";
import { apiUrl, snippets, type QueryState } from "@/lib/query";

const EXAMPLE_INDICATOR = "ACCESS.INTERNET_USERS";
const EXAMPLE_YEARS: [number, number] = [2018, 2025];
/** Gzipped download of the Scalar reference, measured at Phase 5g. */
const SCALAR_MB = 1.3;
const formatNumber = (value: number, tag: string) => new Intl.NumberFormat(tag).format(value);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("developers") };
}

/** Developers (brief §5.9): quick start, embedded API reference and an API key request. */
export default async function DevelopersPage() {
  const locale = await getLocale();
  const [t, query, nav] = await Promise.all([
    getTranslations("Developers"),
    getTranslations("Query"),
    getTranslations("Nav"),
  ]);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? "";
  const base = apiBase || (await siteOrigin());
  // Relative in mock mode, so the browser goes through the app's /api rewrite.
  const specUrl = `${apiBase}/api/v1/openapi.json`;
  const example: QueryState = {
    indicators: [EXAMPLE_INDICATOR],
    areas: [country.iso3],
    years: EXAMPLE_YEARS,
  };

  return (
    <main id="content" className="onn-container py-8">
      <h1>{nav("developers")}</h1>
      <p className="text-muted-foreground mt-2 max-w-prose">{t("intro")}</p>

      <section aria-labelledby="quick-start" className="mt-8 max-w-4xl">
        <h2 id="quick-start">{t("quickStart")}</h2>
        <p className="mt-1 max-w-prose">{t("quickStartBody")}</p>
        <div className="mt-4">
          <ClientMessages namespaces={["Query"]}>
            <CodePanel
              url={apiUrl(base, example, "csv")}
              snippets={snippets(base, example)}
              labels={{
                title: t("example"),
                apiUrl: query("apiUrl"),
                language: query("language"),
                copyUrl: query("copyUrl"),
                copyCode: query.raw("copyCode") as string,
                copied: query("copied"),
              }}
            />
          </ClientMessages>
        </div>
      </section>

      <section aria-labelledby="reference" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="reference">{t("reference")}</h2>
          <a
            href={specUrl}
            className="text-primary inline-flex min-h-11 items-center gap-2 font-semibold underline"
          >
            <FileJsonIcon aria-hidden className="size-5" />
            {t("openapi")}
          </a>
        </div>
        <div className="mt-4">
          <ApiReference
            specUrl={specUrl}
            labels={{
              load: t("loadReference"),
              hint: t("loadReferenceHint", { size: formatNumber(SCALAR_MB, tagFor(locale)) }),
            }}
          />
        </div>
      </section>

      <section aria-labelledby="api-key" className="mt-12 max-w-prose">
        <h2 id="api-key">{t("apiKey")}</h2>
        <p className="mt-1 mb-6">{t("apiKeyBody")}</p>
        <ClientMessages namespaces={["Developers"]}>
          <ApiKeyForm />
        </ClientMessages>
      </section>
    </main>
  );
}
