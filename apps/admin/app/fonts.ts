import localFont from "next/font/local";

// Latin Extended only downloads when a page uses a glyph the Latin file lacks.
export const sourceSans = localFont({
  src: "../../../packages/ui/fonts/source-sans-3-latin-wght-normal.woff2",
  variable: "--font-source-sans",
  weight: "200 900",
  display: "swap",
  fallback: ["system-ui", "Arial"],
});

export const sourceSansExt = localFont({
  src: "../../../packages/ui/fonts/source-sans-3-latin-ext-wght-normal.woff2",
  variable: "--font-source-sans-ext",
  weight: "200 900",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
