import { Button } from "@onn/ui/components/ui/button";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const LINKS = [
  { key: "data", href: "/data" },
  { key: "map", href: "/map" },
  { key: "publications", href: "/publications" },
] as const;

/** 404 (brief §8): a search field (the catalogue's `q`, so it works without JS) and three links. */
export default async function NotFound() {
  const [t, nav, locale] = await Promise.all([
    getTranslations("NotFound"),
    getTranslations("Nav"),
    getLocale(),
  ]);
  return (
    <main id="content" className="onn-container py-16">
      <h1>{t("title")}</h1>
      <p className="mt-3 max-w-prose">{t("body")}</p>
      <form action={`/${locale}/catalogue`} method="get" role="search" className="mt-8 max-w-xl">
        <label htmlFor="not-found-search" className="font-semibold">
          {t("searchLabel")}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="not-found-search"
            type="search"
            name="q"
            className="h-11 min-w-0 flex-1 rounded-md border bg-white px-3"
          />
          <Button type="submit" className="h-11">
            {t("search")}
          </Button>
        </div>
      </form>
      <h2 className="mt-10 text-base font-semibold">{t("tryThese")}</h2>
      <ul className="mt-3 flex flex-wrap gap-3">
        {LINKS.map((link) => (
          <li key={link.key}>
            <Link
              href={link.href}
              className="rounded-pill hover:bg-accent inline-flex min-h-11 items-center border px-4"
            >
              {nav(link.key)}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
