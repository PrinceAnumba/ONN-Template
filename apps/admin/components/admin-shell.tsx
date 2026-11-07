"use client";

import { country } from "@onn/config";
import { Button } from "@onn/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@onn/ui/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@onn/ui/components/ui/sheet";
import { cn } from "@onn/ui/lib/utils";
import {
  BellIcon,
  ChevronRightIcon,
  CircleIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  UserIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { setLocale, setRole, setSidebarCollapsed } from "@/app/actions";
import type { SectionKey } from "@/lib/sections";
import { ROLES, type Role } from "@/lib/roles";
import type { Session } from "@/lib/session";

interface AdminShellProps {
  session: Session;
  sections: { key: SectionKey; href: string }[];
  initialCollapsed: boolean;
  mockRoles: boolean;
  children: ReactNode;
}

function SidebarLinks({
  sections,
  collapsed,
  onNavigate,
}: {
  sections: AdminShellProps["sections"];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("Admin.section");
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1 p-2">
      {sections.map((section) => {
        const active = section.href === "/" ? pathname === "/" : pathname.startsWith(section.href);
        return (
          <li key={section.key}>
            <Link
              href={section.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? t(section.key) : undefined}
              className={cn(
                "hover:bg-accent flex min-h-11 items-center gap-3 rounded-md px-3 text-sm",
                active && "bg-accent font-semibold",
              )}
            >
              <CircleIcon aria-hidden className="size-4 shrink-0" />
              <span className={cn(collapsed && "sr-only")}>{t(section.key)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminShell({
  session,
  sections,
  initialCollapsed,
  mockRoles,
  children,
}: AdminShellProps) {
  const t = useTranslations("Admin");
  const sectionLabel = useTranslations("Admin.section");
  const common = useTranslations("Common");
  const locale = useLocale();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeOrg, setActiveOrg] = useState(session.activeOrg);
  const [, startTransition] = useTransition();

  const current = sections.find((section) =>
    section.href === "/" ? pathname === "/" : pathname.startsWith(section.href),
  );
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    startTransition(() => setSidebarCollapsed(next));
  };

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          "bg-background sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto border-e lg:flex",
          collapsed ? "w-16" : "w-[248px]",
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 px-3">
          {!collapsed && (
            <Image
              src={`/admin${country.brand.logo}`}
              alt={country.observatory.shortName}
              width={120}
              height={36}
              unoptimized
            />
          )}
          <Button
            variant="ghost"
            aria-label={collapsed ? t("expand") : t("collapse")}
            aria-expanded={!collapsed}
            onClick={toggle}
            className="size-11"
          >
            {collapsed ? (
              <PanelLeftOpenIcon aria-hidden className="size-5" />
            ) : (
              <PanelLeftCloseIcon aria-hidden className="size-5" />
            )}
          </Button>
        </div>
        <nav aria-label={t("navigation")}>
          <SidebarLinks sections={sections} collapsed={collapsed} />
        </nav>
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" closeLabel={common("close")} className="overflow-y-auto p-0">
          <SheetHeader>
            <SheetTitle>{country.observatory.shortName}</SheetTitle>
            <SheetDescription className="sr-only">{t("navigation")}</SheetDescription>
          </SheetHeader>
          <nav aria-label={t("navigation")}>
            <SidebarLinks
              sections={sections}
              collapsed={false}
              onNavigate={() => setMenuOpen(false)}
            />
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "bg-background sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4",
            mockRoles && "pe-[72px]",
          )}
        >
          <Button
            variant="ghost"
            aria-label={t("openMenu")}
            onClick={() => setMenuOpen(true)}
            className="size-11 lg:hidden"
          >
            <MenuIcon aria-hidden className="size-5" />
          </Button>
          <nav aria-label={t("breadcrumbRoot")} className="min-w-0">
            <ol className="flex items-center gap-1 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground rounded-sm">
                  {t("breadcrumbRoot")}
                </Link>
              </li>
              {current && (
                <li className="flex items-center gap-1">
                  <ChevronRightIcon aria-hidden className="text-muted-foreground size-4" />
                  <span aria-current="page">{sectionLabel(current.key)}</span>
                </li>
              )}
            </ol>
          </nav>
          <div className="ms-auto flex items-center gap-1">
            {session.orgs.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-11">
                    <span className="sr-only">{t("organisation")}</span>
                    {session.orgs.find((org) => org.code === activeOrg)?.name}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup value={activeOrg} onValueChange={setActiveOrg}>
                    {session.orgs.map((org) => (
                      <DropdownMenuRadioItem key={org.code} value={org.code}>
                        {org.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              aria-label={t("notifications", { count: session.unreadNotifications })}
              className="relative size-11"
            >
              <BellIcon aria-hidden className="size-5" />
              {session.unreadNotifications > 0 && (
                <span
                  aria-hidden
                  className="bg-destructive rounded-pill absolute end-1 top-1 min-w-4 px-1 text-xs text-white"
                >
                  {session.unreadNotifications}
                </span>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" aria-label={t("profile")} className="size-11">
                  <UserIcon aria-hidden className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{session.user.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  {t("language")}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={locale}
                  onValueChange={(next) => startTransition(() => setLocale(next))}
                >
                  {country.locales.enabled.map((item) => (
                    <DropdownMenuRadioItem key={item} value={item}>
                      {item.toUpperCase()}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                {mockRoles && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-muted-foreground text-xs">
                      {t("role")}
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={session.roles[0]}
                      onValueChange={(next) => startTransition(() => setRole(next as Role))}
                    >
                      {ROLES.map((role) => (
                        <DropdownMenuRadioItem key={role} value={role}>
                          {t(`roles.${role}`)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings/mfa">{t("mfa")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/login">{t("signOut")}</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="content" className="mx-auto w-full max-w-[1440px] flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
