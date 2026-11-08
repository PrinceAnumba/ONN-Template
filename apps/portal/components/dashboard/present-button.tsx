"use client";

import { Button } from "@onn/ui/components/ui/button";
import { PresentationIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { parseAsInteger, useQueryState } from "nuqs";
import { useRef } from "react";
import type { WidgetModel } from "@/lib/dashboard";
import type { PresentationLabels } from "./presentation";

const load = () => import("./presentation");
const Presentation = dynamic(load, { ssr: false });

export interface PresentButtonProps {
  slides: WidgetModel[];
  logo: string;
  tag: string;
  label: string;
  labels: PresentationLabels;
}

/**
 * "Present" (brief §5.5). The slide lives in `?p=` (1-based), so a link can open a given slide;
 * such a link opens the overlay without fullscreen, which browsers allow only after a click.
 */
export function PresentButton({ slides, logo, tag, label, labels }: PresentButtonProps) {
  const button = useRef<HTMLButtonElement>(null);
  const [p, setP] = useQueryState(
    "p",
    parseAsInteger.withOptions({ history: "replace", shallow: true, scroll: false }),
  );
  if (!slides.length) return null;
  const open = p !== null;
  const index = Math.min(Math.max((p ?? 1) - 1, 0), slides.length - 1);

  const close = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    void setP(null);
    button.current?.focus();
  };

  return (
    <>
      <Button
        ref={button}
        onPointerEnter={() => void load()}
        onFocus={() => void load()}
        onClick={() => {
          void document.documentElement.requestFullscreen?.().catch(() => undefined);
          void setP(1);
        }}
      >
        <PresentationIcon aria-hidden />
        {label}
      </Button>
      {open && (
        <Presentation
          slides={slides}
          index={index}
          onIndexChange={(next) => void setP(next + 1)}
          onClose={close}
          logo={logo}
          tag={tag}
          labels={labels}
        />
      )}
    </>
  );
}
