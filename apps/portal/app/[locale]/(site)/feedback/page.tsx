import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FeedbackForm } from "@/components/forms/feedback-form";
import { ClientMessages } from "@/components/shell/client-messages";
import { safeErrorId, safePath } from "@/lib/forms";

type Params = Record<string, string | string[] | undefined>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("feedback") };
}

/** Feedback (brief §5.9). "Report an issue" links here with `?page=` set to where it came from. */
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Params> }) {
  const [t, nav, params] = await Promise.all([
    getTranslations("Feedback"),
    getTranslations("Nav"),
    searchParams,
  ]);
  const page = safePath([params.page ?? "/"].flat()[0] ?? "/");
  const errorId = safeErrorId([params.error ?? ""].flat()[0] ?? "");
  return (
    <main id="content" className="onn-container py-8">
      <h1>{nav("feedback")}</h1>
      <p className="text-muted-foreground mt-2 mb-6 max-w-prose">{t("intro")}</p>
      <ClientMessages namespaces={["Feedback"]}>
        <FeedbackForm page={page} errorId={errorId} />
      </ClientMessages>
    </main>
  );
}
