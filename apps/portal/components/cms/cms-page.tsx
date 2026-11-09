import { ApiError, api, serverCache } from "@onn/api-client";
import { cn } from "@onn/ui/lib/utils";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { cache } from "react";
import { Link } from "@/i18n/navigation";
import { isLite } from "@/lib/lite";
import { CmsBlocks } from "./cms-blocks";

export const getCmsPage = cache(async (slug: string, locale: string) =>
  api.page({ locale, next: serverCache(`page:${slug}`) }, slug).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }),
);

export async function cmsMetadata(slug: string): Promise<Metadata> {
  const page = await getCmsPage(slug, await getLocale());
  return { title: page.title };
}

const ABOUT = [
  { slug: "about", href: "/about", key: "about" },
  { slug: "methodology", href: "/about/methodology", key: "methodology" },
  { slug: "partners", href: "/about/partners", key: "partners" },
] as const;

/** Links between the three about pages. */
async function AboutNav({ current }: { current: string }) {
  const t = await getTranslations("Nav");
  const about = await getTranslations("About");
  return (
    <nav aria-label={about("sectionNav")} className="mt-4 border-b">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {ABOUT.map((item) => (
          <li key={item.slug}>
            <Link
              href={item.href}
              aria-current={item.slug === current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center border-b-2 border-transparent px-3 font-semibold whitespace-nowrap",
                item.slug === current
                  ? "border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(item.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A CMS page: title, optional about-section tabs, blocks, then anything page-specific. */
export async function CmsPageView({
  slug,
  section,
  before,
  children,
}: {
  slug: string;
  section?: "about";
  /** Shown above the CMS blocks, e.g. the legal facts from config on the privacy page. */
  before?: ReactNode;
  children?: ReactNode;
}) {
  const locale = await getLocale();
  const [page, t, common, lite] = await Promise.all([
    getCmsPage(slug, locale),
    getTranslations("About"),
    getTranslations("Common"),
    isLite(),
  ]);
  return (
    <main id="content" className="onn-container py-8">
      <h1>{page.title}</h1>
      {section === "about" && <AboutNav current={slug} />}
      <div className="mt-6 flex flex-col gap-10">
        {before}
        <CmsBlocks
          blocks={page.blocks}
          tableCaption={t("tableCaption", { title: page.title })}
          lite={lite}
          imageHidden={common("imageHidden")}
        />
        {children}
      </div>
    </main>
  );
}
