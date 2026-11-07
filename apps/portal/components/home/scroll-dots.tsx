"use client";

import { cn } from "@onn/ui/lib/utils";
import { useEffect, useState } from "react";

/** Position dots for a horizontal scroll-snap row on small screens (brief §5.1). */
export function ScrollDots({ target, count }: { target: string; count: number }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const row = document.getElementById(target);
    if (!row) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(Array.from(row.children).indexOf(entry.target));
          }
        }
      },
      { root: row, threshold: 0.6 },
    );
    Array.from(row.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [target]);

  return (
    <div aria-hidden className="mt-3 flex justify-center gap-1.5 sm:hidden">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn("size-2 rounded-full", i === active ? "bg-brand" : "bg-border")}
        />
      ))}
    </div>
  );
}
