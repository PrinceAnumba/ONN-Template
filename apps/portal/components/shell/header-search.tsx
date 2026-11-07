"use client";

import { Button } from "@onn/ui/components/ui/button";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CommandPalette = dynamic(() => import("./command-palette"), { ssr: false });

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function HeaderSearch() {
  const t = useTranslations("Header");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (shortcut || (event.key === "/" && !isTyping(event.target))) {
        event.preventDefault();
        setMounted(true);
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        aria-label={t("search")}
        className="size-11"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <SearchIcon aria-hidden className="size-5" />
      </Button>
      {mounted && <CommandPalette open={open} onOpenChange={setOpen} />}
    </>
  );
}
