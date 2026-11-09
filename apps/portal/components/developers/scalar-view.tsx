"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
// The package doesn't import its own styles; this chunk carries them, so no other page does.
import "@scalar/api-reference-react/style.css";
import { useEffect, useRef } from "react";

// Scalar's lightest grey is under 4.5:1 on white; use the site's muted text colour instead.
const SCALAR_CSS = [
  ".scalar-app, .scalar-app .light-mode { --scalar-color-3: var(--muted-foreground); }",
  ".scalar-app .sidebar-search-placeholder { color: var(--muted-foreground); }",
].join(" ");

type Configuration = Parameters<typeof ApiReferenceReact>[0]["configuration"];

/** Loaded by ApiReference only; importing it anywhere else puts Scalar in that page's bundle. */
export function ScalarView({ specUrl }: { specUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);

  // Scalar titles the document with an h1, and the page already has one (§9: one h1 per page).
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const demote = () =>
      node.querySelectorAll("h1:not([aria-level])").forEach((heading) => {
        heading.setAttribute("role", "heading");
        heading.setAttribute("aria-level", "2");
      });
    demote();
    const observer = new MutationObserver(demote);
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      <ApiReferenceReact
        // showToolbar is accepted at runtime but missing from the published type.
        configuration={
          {
            url: specUrl,
            layout: "classic",
            theme: "default",
            withDefaultFonts: false,
            forceDarkModeState: "light",
            hideDarkModeToggle: true,
            hideClientButton: true,
            hideDownloadButton: true,
            showToolbar: "never",
            showDeveloperTools: "never",
            telemetry: false,
            agent: { disabled: true },
            mcp: { disabled: true },
            customCss: SCALAR_CSS,
          } as Configuration
        }
      />
    </div>
  );
}
