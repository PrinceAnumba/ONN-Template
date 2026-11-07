import { country } from "@onn/config";
import { getLocale } from "next-intl/server";

export default async function HomePage() {
  const locale = await getLocale();
  return (
    <main id="content" className="bg-surface-2">
      <div className="onn-container py-16">
        <h1 className="text-display">{country.observatory.longName[locale]}</h1>
      </div>
    </main>
  );
}
