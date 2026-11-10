import { ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserForm } from "@/components/users/user-form";
import { requireSession } from "@/lib/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const t = await getTranslations("Admin.users");
  return { title: t("detailTitle", { id: (await params).id }) };
}

/** One user: role, organisations and access (brief §7). */
export default async function UserPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.users");
  const ctx = { locale, token: session.token };
  const [user, { orgs }] = await Promise.all([
    adminApi.user(ctx, id).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    adminApi.users(ctx, { pageSize: 25 }),
  ]);
  return (
    <>
      <Link href="/users" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <h1 className="text-h1 mb-6">{user.name}</h1>
      <UserForm
        // Remount after a save or an action, so the form shows what the server now holds.
        key={`${user.status}-${user.roles.join()}-${user.invitedAt ?? ""}`}
        initial={user}
        orgs={orgs}
        viewer={{ id: session.user.id, superAdmin: session.roles.includes("super_admin") }}
      />
    </>
  );
}
