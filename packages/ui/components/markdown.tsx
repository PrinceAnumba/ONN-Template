"use client";

import { cn } from "@onn/ui/lib/utils";
import * as React from "react";

/**
 * Markdown with $$LaTeX$$ (brief §5.3). marked, KaTeX and DOMPurify load on first render, so
 * they stay out of every page bundle; the plain text shows until then.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const [html, setHtml] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void import("./markdown-render").then(({ renderMarkdown }) => {
      if (!cancelled) setHtml(renderMarkdown(source));
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (html === null) return <p className={cn("whitespace-pre-line", className)}>{source}</p>;
  return (
    <div
      className={cn("onn-prose", className)}
      // Sanitised by DOMPurify in renderMarkdown.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
