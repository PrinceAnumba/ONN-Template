import { adminApi } from "@onn/api-client/admin";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { UserForm } from "@/components/users/user-form";
import { requireSession } from "@/lib/session";

export async function generateMetadata() {
  return { title: (await getTranslations("Admin.users"))("inviteTitle") };
}

/** Invite a user (brief §7). */
export default async function InviteUserPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.users");
  const { orgs } = await adminApi.users({ locale, token: session.token }, { pageSize: 25 });
  return (
    <>
      <Link href="/users" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <h1 className="text-h1">{t("inviteTitle")}</h1>
      <p className="text-muted-foreground mt-1 mb-6 max-w-2xl">{t("inviteIntro")}</p>
      <UserForm
        orgs={orgs}
        viewer={{ id: session.user.id, superAdmin: session.roles.includes("super_admin") }}
      />
    </>
  );
}
