"use client";

import { cn } from "@onn/ui/lib/utils";
import { useEffect, useState, type ReactNode } from "react";

const SCROLL_THRESHOLD = 8;

export function StickyHeader({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b bg-white",
        scrolled && "bg-white/92 shadow-sm backdrop-blur-[8px] backdrop-saturate-[1.4]",
      )}
    >
      {children}
    </header>
  );
}
