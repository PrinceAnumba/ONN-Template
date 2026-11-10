import { adminApi } from "@onn/api-client/admin";
import { EmptyState } from "@onn/ui/components/empty-state";
import { StatusPill } from "@onn/ui/components/status-pill";
import { DownloadIcon, UsersIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  FILTER_FIELD,
  listHref,
  ListPager,
  PrimaryLink,
  TabLinks,
  TableFrame,
} from "@/components/list";
import { BFF } from "@/lib/bff";
import { formatDate } from "@/lib/format";
import { USER_STATUSES, USER_TONE } from "@/lib/governance";
import { ROLES } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { PAGE_SIZES } from "@/lib/submissions";

interface UsersProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    role?: string;
    org?: string;
    page?: string;
    size?: string;
  }>;
}

/** Users (brief §7): who has access, with what role, MFA and last sign-in. */
export default async function UsersPage({ searchParams }: UsersProps) {
  const params = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.users");
  const roles = await getTranslations("Admin.roles");
  const forms = await getTranslations("Admin.forms");
  const common = await getTranslations("Common");
  const status = USER_STATUSES.find((item) => item === params.status);
  const role = ROLES.find((item) => item === params.role);
  const pageSize = PAGE_SIZES.find((size) => String(size) === params.size) ?? PAGE_SIZES[0]!;
  const result = await adminApi.users(
    { locale, token: session.token },
    {
      q: params.q?.trim() || undefined,
      status,
      role,
      org: params.org || undefined,
      page: Number(params.page) || 1,
      pageSize,
    },
  );
  const org = result.orgs.find((item) => item.code === params.org)?.code;
  const filters = { q: params.q?.trim(), role, org };
  const href = (changes: Record<string, string | number | undefined>) =>
    listHref("/users", {
      ...filters,
      status,
      size: pageSize === PAGE_SIZES[0] ? undefined : pageSize,
      ...changes,
    });
  const filtered = Boolean(filters.q || role || org);
  const total = USER_STATUSES.reduce((sum, item) => sum + result.counts[item], 0);
  const invite = <PrimaryLink href="/users/invite">{t("invite")}</PrimaryLink>;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-h1">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-3">
          {/* A plain link, so it needs the base path; the BFF adds the session token. */}
          <a
            href={`${BFF}/users/access-review`}
            download
            className="bg-background inline-flex h-11 items-center gap-2 rounded-md border px-4 font-semibold"
          >
            <DownloadIcon aria-hidden="true" className="size-4" />
            {t("accessReview")}
          </a>
          {invite}
        </div>
      </div>
      <TabLinks
        label={t("tabsLabel")}
        tabs={[
          {
            href: href({ status: undefined, page: undefined }),
            label: forms("all"),
            active: !status,
            count: total,
          },
          ...USER_STATUSES.map((item) => ({
            href: href({ status: item, page: undefined }),
            label: t(`status.${item}`),
            active: status === item,
            count: result.counts[item],
          })),
        ]}
      />
      <form action="/admin/users" method="get" className="mt-6 flex flex-wrap items-end gap-3">
        {status && <input type="hidden" name="status" value={status} />}
        <div>
          <label htmlFor="users-q" className="mb-1 block font-semibold">
            {t("filter.search")}
          </label>
          <input
            id="users-q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            className={`${FILTER_FIELD} w-64 max-w-full`}
          />
        </div>
        <div>
          <label htmlFor="users-role" className="mb-1 block font-semibold">
            {t("filter.role")}
          </label>
          <select id="users-role" name="role" defaultValue={role ?? ""} className={FILTER_FIELD}>
            <option value="">{forms("all")}</option>
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {roles(item)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="users-org" className="mb-1 block font-semibold">
            {t("filter.org")}
          </label>
          <select
            id="users-org"
            name="org"
            defaultValue={org ?? ""}
            className={`${FILTER_FIELD} max-w-64`}
          >
            <option value="">{forms("all")}</option>
            {result.orgs.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-11 rounded-md px-4 font-semibold"
        >
          {common("apply")}
        </button>
        {filtered && (
          <Link
            href={listHref("/users", { status })}
            className="inline-flex h-11 items-center underline"
          >
            {forms("clearFilters")}
          </Link>
        )}
      </form>
      <p role="status" className="text-muted-foreground mt-4">
        {t("count", { count: result.meta.total })}
      </p>
      <div className="mt-2">
        {result.items.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            message={t(filtered || status ? "emptyFiltered" : "empty")}
            action={invite}
          />
        ) : (
          <TableFrame
            label={t("title")}
            columns={(["name", "email", "role", "orgs", "mfa", "lastLogin", "status"] as const).map(
              (key) => t(`column.${key}`),
            )}
          >
            {result.items.map((user) => (
              <tr key={user.id} className="border-t align-top">
                <th scope="row" className="min-w-44 p-3 text-start font-semibold">
                  <Link href={`/users/${user.id}`} className="underline">
                    {user.name}
                  </Link>
                </th>
                <td className="p-3">{user.email}</td>
                <td className="p-3 whitespace-nowrap">
                  {user.roles.map((item) => roles(item)).join(", ")}
                </td>
                <td className="min-w-48 p-3">
                  {user.orgs.length > 2
                    ? t("orgCount", { first: user.orgs[0]!.name, count: user.orgs.length - 1 })
                    : user.orgs.map((item) => item.name).join(", ")}
                </td>
                <td className="p-3 whitespace-nowrap">{t(user.mfa ? "mfaOn" : "mfaOff")}</td>
                <td className="p-3 whitespace-nowrap">
                  {user.lastLogin ? formatDate(user.lastLogin, locale, "medium") : t("never")}
                </td>
                <td className="p-3">
                  <StatusPill tone={USER_TONE[user.status]} label={t(`status.${user.status}`)} />
                </td>
              </tr>
            ))}
          </TableFrame>
        )}
      </div>
      <ListPager meta={result.meta} href={({ page, size }) => href({ page, size })} />
    </>
  );
}
