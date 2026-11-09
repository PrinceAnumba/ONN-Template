import { isMockMode } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { country } from "@onn/config";
import { Button } from "@onn/ui/components/ui/button";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CodeForm } from "@/components/login/code-form";
import { getSession, MFA_COOKIE } from "@/lib/session";

const ERRORS = ["sso", "expired"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.login");
  return { title: t("pageTitle", { site: country.observatory.shortName }) };
}

interface LoginProps {
  searchParams: Promise<{ step?: string; error?: string; signedOut?: string }>;
}

/** Sign-in (brief §7): "Sign in with {SSO}", then a six-digit MFA code. */
export default async function LoginPage({ searchParams }: LoginProps) {
  if (await getSession()) redirect("/");
  const params = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("Admin");
  const pending = (await cookies()).get(MFA_COOKIE)?.value;
  const mfaStep = params.step === "mfa" && Boolean(pending);
  const error = ERRORS.find((item) => item === params.error);
  const demoUsers = isMockMode && !mfaStep ? await adminApi.demoUsers(locale).catch(() => []) : [];
  const sso = country.auth.ssoName;

  return (
    <main
      id="content"
      tabIndex={-1}
      className="bg-surface-2 flex min-h-dvh items-center justify-center px-4 py-10"
    >
      <div className="bg-background w-full max-w-sm rounded-lg border p-6 shadow-sm sm:p-8">
        <Image
          src={`/admin${country.brand.logo}`}
          alt={country.observatory.shortName}
          width={140}
          height={42}
          unoptimized
          priority
        />
        <h1 className="text-h2 mt-6">{mfaStep ? t("login.mfaTitle") : t("login.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {mfaStep ? t("login.mfaIntro") : t("login.intro")}
        </p>

        {error && (
          <p
            role="alert"
            className="border-destructive text-destructive mt-4 rounded-md border p-3 text-sm"
          >
            {t(`login.error.${error}`, { sso })}
          </p>
        )}
        {params.signedOut && !error && (
          <p role="status" className="bg-surface-2 mt-4 rounded-md p-3 text-sm">
            {t("login.signedOut")}
          </p>
        )}

        <div className="mt-6">
          {mfaStep ? (
            <>
              <CodeForm />
              <Link href="/login" className="mt-4 inline-block text-sm underline">
                {t("login.back")}
              </Link>
            </>
          ) : (
            // basePath isn't added to a plain form action.
            <form action="/admin/login/sso" method="post" className="flex flex-col gap-4">
              {demoUsers.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="user" className="text-sm font-semibold">
                    {t("login.demoUser")}
                  </label>
                  <select
                    id="user"
                    name="user"
                    defaultValue={demoUsers.find((user) => user.roles.includes("admin"))?.id}
                    className="border-input bg-background h-11 rounded-md border px-3"
                  >
                    {demoUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {t("demoUserOption", {
                          name: user.name,
                          role: user.roles.map((role) => t(`roles.${role}`)).join(", "),
                        })}
                      </option>
                    ))}
                  </select>
                  <p className="text-muted-foreground text-xs">{t("login.demoHint")}</p>
                </div>
              )}
              <Button type="submit" size="lg">
                {t("login.sso", { sso })}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
