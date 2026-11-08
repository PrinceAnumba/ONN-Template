"use client";

import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { cn } from "@onn/ui/lib/utils";
import { CopyIcon } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";

const LANGUAGES = ["curl", "python", "r", "js"] as const;
type Language = (typeof LANGUAGES)[number];
const NAMES: Record<Language, string> = {
  curl: "curl",
  python: "Python",
  r: "R",
  js: "JavaScript",
};

export interface CodePanelProps {
  url: string;
  snippets: Record<Language, string>;
  labels: {
    title: string;
    apiUrl: string;
    language: string;
    copyUrl: string;
    /** Template with {language}. */
    copyCode: string;
    copied: string;
  };
}

/** The equivalent API URL and curl / Python / R / JS snippets, each with a copy button (§5.7). */
export function CodePanel({ url, snippets, labels }: CodePanelProps) {
  const id = useId();
  const [active, setActive] = useState<Language>("curl");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showToast(labels.copied);
  };

  // APG tabs: arrows move and select, Home/End jump.
  const onKey = (event: KeyboardEvent, index: number) => {
    const last = LANGUAGES.length - 1;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];
    let next: number | undefined;
    if (step !== undefined) next = (index + step + LANGUAGES.length) % LANGUAGES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === undefined) return;
    event.preventDefault();
    setActive(LANGUAGES[next]!);
    tabs.current[next]?.focus();
  };

  return (
    <section aria-labelledby={`${id}-title`} className="bg-card rounded-lg border p-4">
      <h2 id={`${id}-title`} className="text-h3">
        {labels.title}
      </h2>
      <p className="mt-3 text-sm font-semibold">{labels.apiUrl}</p>
      <div className="mt-1 flex items-start gap-2">
        <code className="bg-surface-2 min-w-0 flex-1 rounded-md p-2 text-sm break-all">{url}</code>
        <Button
          variant="secondary"
          size="icon"
          aria-label={labels.copyUrl}
          onClick={() => void copy(url)}
        >
          <CopyIcon aria-hidden />
        </Button>
      </div>
      <div role="tablist" aria-label={labels.language} className="mt-4 flex gap-1 border-b">
        {LANGUAGES.map((language, index) => (
          <button
            key={language}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${language}`}
            aria-selected={active === language}
            aria-controls={`${id}-panel`}
            tabIndex={active === language ? 0 : -1}
            onClick={() => setActive(language)}
            onKeyDown={(event) => onKey(event, index)}
            className={cn(
              "-mb-px min-h-11 border-b-2 px-3 text-sm font-medium",
              active === language ? "border-primary" : "text-muted-foreground border-transparent",
            )}
          >
            {NAMES[language]}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${active}`}
        className="relative mt-3"
      >
        <pre
          // Scrollable region must be reachable by keyboard.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="bg-foreground overflow-x-auto rounded-md p-3 pe-14 text-sm text-white"
        >
          <code>{snippets[active]}</code>
        </pre>
        <Button
          variant="secondary"
          size="icon"
          aria-label={labels.copyCode.replace("{language}", NAMES[active])}
          onClick={() => void copy(snippets[active])}
          className="absolute end-2 top-2"
        >
          <CopyIcon aria-hidden />
        </Button>
      </div>
    </section>
  );
}
