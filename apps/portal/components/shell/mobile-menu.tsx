"use client";

import { Button } from "@onn/ui/components/ui/button";
import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

const MobileMenuSheet = dynamic(() => import("./mobile-menu-sheet"), { ssr: false });

export function MobileMenu() {
  const t = useTranslations("Header");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={trigger}
        variant="ghost"
        aria-label={t("openMenu")}
        aria-expanded={open}
        className="size-11 lg:hidden"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <MenuIcon aria-hidden className="size-5" />
      </Button>
      {mounted && (
        <MobileMenuSheet
          open={open}
          onOpenChange={setOpen}
          onClosed={() => trigger.current?.focus()}
        />
      )}
    </>
  );
}
