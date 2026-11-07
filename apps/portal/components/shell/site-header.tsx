import { isMockMode } from "@onn/api-client";
import { country } from "@onn/config";
import { cn } from "@onn/ui/lib/utils";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { HeaderSearch } from "./header-search";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { StickyHeader } from "./sticky-header";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  const header = await getTranslations("Header");

  return (
    <StickyHeader>
      <div
        className={cn(
          "onn-container flex h-[60px] items-center gap-4 lg:h-[72px]",
          isMockMode && "pe-14 lg:pe-[72px]",
        )}
      >
        <Link href="/" className="flex shrink-0 items-center gap-3 rounded-md">
          <Image src={country.brand.logo} alt="" width={120} height={36} unoptimized />
          <span className="text-h3 max-sm:sr-only">{country.observatory.shortName}</span>
          <span className="sr-only">{header("home")}</span>
        </Link>
        <NavLinks className="mx-auto hidden lg:flex" />
        <div className="ms-auto flex items-center gap-2 lg:ms-0">
          <HeaderSearch />
          <div className="hidden items-center gap-3 lg:flex">
            <Suspense>
              <LocaleSwitcher />
            </Suspense>
            <Link href="/developers" className="rounded-md text-[15px] font-medium">
              {t("developers")}
            </Link>
          </div>
          <Suspense>
            <MobileMenu />
          </Suspense>
        </div>
      </div>
    </StickyHeader>
  );
}
