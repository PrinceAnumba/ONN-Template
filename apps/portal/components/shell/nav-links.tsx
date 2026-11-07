"use client";

import { cn } from "@onn/ui/lib/utils";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { PRIMARY_NAV } from "@/lib/nav";

export function NavLinks({ className }: { className?: string }) {
  const t = useTranslations("Nav");
  const header = useTranslations("Header");
  const pathname = usePathname();

  return (
    <nav aria-label={header("mainNavigation")} className={className}>
      <ul className="flex items-center gap-6">
        {PRIMARY_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative block rounded-sm text-[15px] font-medium whitespace-nowrap",
                  "after:bg-brand after:absolute after:inset-x-0 after:-bottom-1.5 after:h-0.5",
                  "after:origin-center after:scale-x-0 after:transition-transform",
                  "after:duration-(--onn-dur-2) hover:after:scale-x-100",
                  "motion-reduce:after:transition-none",
                  active && "after:scale-x-100",
                )}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
