"use client";

import type { AdminNotification, AdminRole, DemoUser, Organisation } from "@onn/api-client/types";
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
  BadgeCheckIcon,
  BellIcon,
  Building2Icon,
  ChevronRightIcon,
  FileChartColumnIcon,
  FileTextIcon,
  Grid3x3Icon,
  HistoryIcon,
  InboxIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  ListTreeIcon,
  MailIcon,
  MenuIcon,
  MessageSquareIcon,
  NewspaperIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelsTopLeftIcon,
  PlugIcon,
  SettingsIcon,
  SirenIcon,
  UploadIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  markNotificationsRead,
  setActiveOrg,
  setLocale,
  setSidebarCollapsed,
  signOut,
  switchUser,
} from "@/app/actions";
import { formatDate } from "@/lib/format";
import type { SectionKey } from "@/lib/sections";

const ICONS: Record<SectionKey, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  submissions: InboxIcon,
  entry: Grid3x3Icon,
  imports: UploadIcon,
  connectors: PlugIcon,
  quality: BadgeCheckIcon,
  indicators: ListTreeIcon,
  dashboards: LayoutGridIcon,
  publications: FileTextIcon,
  reports: FileChartColumnIcon,
  news: NewspaperIcon,
  pages: PanelsTopLeftIcon,
  alerts: SirenIcon,
  newsletter: MailIcon,
  users: UsersIcon,
  organisations: Building2Icon,
  feedback: MessageSquareIcon,
  audit: HistoryIcon,
  settings: SettingsIcon,
};

/** Value for "all of my organisations" in the switcher (an empty Radix value isn't allowed). */
const ALL_ORGS = "*";

export interface ShellSession {
  user: { id: string; name: string; email: string };
  roles: AdminRole[];
  orgs: Organisation[];
  activeOrg?: string;
}

interface AdminShellProps {
  session: ShellSession;
  sections: { key: SectionKey; href: string }[];
  notifications: AdminNotification[];
  demoUsers: DemoUser[];
  initialCollapsed: boolean;
  mockMode: boolean;
  children: ReactNode;
}

const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

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
        const active = isActive(section.href, pathname);
        const Icon = ICONS[section.key];
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
              <Icon aria-hidden className="size-5 shrink-0" />
              <span className={cn(collapsed && "sr-only")}>{t(section.key)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NotificationsMenu({ notifications }: { notifications: AdminNotification[] }) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const [, startTransition] = useTransition();
  const unread = notifications.filter((item) => !item.read);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label={t("notifications", { count: unread.length })}
          className="relative size-11"
        >
          <BellIcon aria-hidden className="size-5" />
          {unread.length > 0 && (
            <span
              aria-hidden
              className="bg-destructive rounded-pill absolute end-1 top-1 min-w-4 px-1 text-xs text-white"
            >
              {unread.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[min(70dvh,32rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto"
      >
        <DropdownMenuLabel>{t("notificationsTitle")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="text-muted-foreground px-2 py-3 text-sm">{t("notificationsEmpty")}</p>
        ) : (
          notifications.map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                href={item.href}
                onClick={() => {
                  if (!item.read) startTransition(() => markNotificationsRead([item.id]));
                }}
                className="flex flex-col items-start gap-0.5"
              >
                <span className={cn("text-sm", !item.read && "font-semibold")}>
                  {!item.read && <span className="sr-only">{t("unread")} </span>}
                  {t(`notification.${item.kind}`, { subject: item.subject })}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(item.date, locale, "medium")}
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
        {unread.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                startTransition(() => markNotificationsRead(unread.map((item) => item.id)))
              }
            >
              {t("markAllRead")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminShell({
  session,
  sections,
  notifications,
  demoUsers,
  initialCollapsed,
  mockMode,
  children,
}: AdminShellProps) {
  const t = useTranslations("Admin");
  const sectionLabel = useTranslations("Admin.section");
  const common = useTranslations("Common");
  const locale = useLocale();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, startTransition] = useTransition();

  const current = sections.find((section) => isActive(section.href, pathname));
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    startTransition(() => setSidebarCollapsed(next));
  };
  const activeOrgName = session.orgs.find((org) => org.code === session.activeOrg)?.name;

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
            mockMode && "pe-[72px]",
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
          <nav aria-label={t("breadcrumb")} className="min-w-0">
            <ol className="flex items-center gap-1 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground rounded-sm">
                  {t("breadcrumbRoot")}
                </Link>
              </li>
              {current && current.href !== "/" && (
                <li className="flex min-w-0 items-center gap-1">
                  <ChevronRightIcon
                    aria-hidden
                    className="text-muted-foreground size-4 shrink-0 rtl:rotate-180"
                  />
                  <span aria-current="page" className="truncate">
                    {sectionLabel(current.key)}
                  </span>
                </li>
              )}
            </ol>
          </nav>
          <div className="ms-auto flex items-center gap-1">
            {session.orgs.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    aria-label={t("organisationCurrent", {
                      name: activeOrgName ?? t("allOrganisations"),
                    })}
                    className="h-11 max-w-56"
                  >
                    <Building2Icon aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{activeOrgName ?? t("allOrganisations")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t("organisation")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={session.activeOrg ?? ALL_ORGS}
                    onValueChange={(next) =>
                      startTransition(() => setActiveOrg(next === ALL_ORGS ? "" : next))
                    }
                  >
                    <DropdownMenuRadioItem value={ALL_ORGS}>
                      {t("allOrganisations")}
                    </DropdownMenuRadioItem>
                    {session.orgs.map((org) => (
                      <DropdownMenuRadioItem key={org.code} value={org.code}>
                        {org.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <NotificationsMenu notifications={notifications} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" aria-label={t("profile")} className="size-11">
                  <UserIcon aria-hidden className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="flex flex-col">
                  <span>{session.user.name}</span>
                  <span className="text-muted-foreground text-xs font-normal">
                    {session.roles.map((role) => t(`roles.${role}`)).join(", ")}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  {t("language")}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={locale}
                  onValueChange={(next) => startTransition(() => setLocale(next))}
                >
                  {country.locales.enabled.map((item) => (
                    <DropdownMenuRadioItem key={item} value={item} lang={item}>
                      {item.toUpperCase()}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                {mockMode && demoUsers.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-muted-foreground text-xs">
                      {t("demoUser")}
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={session.user.id}
                      onValueChange={(next) => startTransition(() => switchUser(next))}
                    >
                      {demoUsers.map((user) => (
                        <DropdownMenuRadioItem key={user.id} value={user.id}>
                          {t("demoUserOption", {
                            name: user.name,
                            role: user.roles.map((role) => t(`roles.${role}`)).join(", "),
                          })}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile/mfa">{t("mfa")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => startTransition(() => signOut())}>
                  {t("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
