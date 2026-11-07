"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@onn/ui/components/ui/sheet";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PRIMARY_NAV } from "@/lib/nav";
import { LocaleSwitcher } from "./locale-switcher";

interface MobileMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
}

export default function MobileMenuSheet({ open, onOpenChange, onClosed }: MobileMenuSheetProps) {
  const t = useTranslations("Nav");
  const header = useTranslations("Header");
  const common = useTranslations("Common");
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        closeLabel={common("close")}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
        className="overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{header("menu")}</SheetTitle>
          <SheetDescription className="sr-only">{header("mainNavigation")}</SheetDescription>
        </SheetHeader>
        <nav aria-label={header("mainNavigation")} className="px-4">
          <ul>
            {[...PRIMARY_NAV, { key: "developers", href: "/developers" } as const].map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={close}
                  className="flex min-h-11 items-center rounded-sm font-medium"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t px-4 pt-2">
          <LocaleSwitcher />
        </div>
      </SheetContent>
    </Sheet>
  );
}
