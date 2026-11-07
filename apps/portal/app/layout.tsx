import type { ReactNode } from "react";

// The <html> element lives in [locale]/layout.tsx, where the language is known.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
