import { api, serverCache } from "@onn/api-client";
import { country } from "@onn/config";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HeroSelector } from "@/components/home/hero-selector";
import {
  BenchmarkStrip,
  DashboardCards,
  DataPartners,
  KeyFigures,
  LatestNews,
  LatestPublications,
  MapTeaser,
  StrategyTracker,
} from "@/components/home/sections";
import { Link } from "@/i18n/navigation";
import { getSelectorData } from "@/lib/selector-data";

interface PageProps {
  params: Promise<{ locale: string }>;
}

async function getHome(locale: string) {
  return api.home({ locale, next: serverCache("home") }).catch(() => null);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const home = await getHome(locale);
  return { description: home?.mission };
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const [home, selectorData] = await Promise.all([getHome(locale), getSelectorData(locale)]);

  return (
    <main id="content">
      <section className="bg-surface-2 pt-10 pb-8 md:pt-16 md:pb-12">
        <div className="onn-container">
          <h1 className="text-display">{country.observatory.longName[locale]}</h1>
          {home && <p className="text-muted-foreground mt-3 max-w-3xl text-lg">{home.mission}</p>}
          <div className="mt-8">
            <HeroSelector data={selectorData} exploreLabel={t("explore")} />
          </div>
          {home && home.exampleChips.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label={t("examples")}>
              {home.exampleChips.slice(0, 5).map((chip) => (
                <li key={chip.href}>
                  <Link
                    href={chip.href}
                    className="rounded-pill bg-background hover:bg-accent inline-flex min-h-11 items-center border px-4 text-sm"
                  >
                    {chip.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <KeyFigures />
      <StrategyTracker />
      <MapTeaser />
      <BenchmarkStrip />
      <DashboardCards />
      <LatestPublications />
      <LatestNews />
      <DataPartners />
    </main>
  );
}
