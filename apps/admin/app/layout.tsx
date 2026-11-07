import "@onn/ui/base.css";
import { country } from "@onn/config";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { sourceSans, sourceSansExt } from "./fonts";

const locale = country.locales.default;

export const metadata: Metadata = {
  title: `${country.observatory.shortName} ${country.name[locale]}`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={locale} className={`${sourceSans.variable} ${sourceSansExt.variable}`}>
      <body>{children}</body>
    </html>
  );
}
