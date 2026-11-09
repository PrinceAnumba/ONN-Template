"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

type SkeletonModule = typeof import("./route-skeletons");

/** Wait this long before swapping in a skeleton, so fast navigations don't flash. */
const SHOW_AFTER_MS = 200;
/** Paths Next doesn't render client-side: the admin zone and file routes (RSS, DCAT). */
const FULL_LOAD = /^\/admin(\/|$)|\.(xml|jsonld|json|csv|pdf|txt)$/;

let skeletons: Promise<SkeletonModule> | undefined;
const loadSkeletons = () => (skeletons ??= import("./route-skeletons"));

function targetPath(event: MouseEvent): string | null {
  if (event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin || FULL_LOAD.test(url.pathname)) return null;
  // Same page with a new query (tabs, filters): the old content stays, as §8 asks.
  if (url.pathname === location.pathname) return null;
  return url.pathname;
}

/**
 * Route skeletons for client navigation (spec decision: first loads wait for complete HTML,
 * so pages read without JavaScript). A link click to another page hides the current page
 * and shows the target route's skeleton until the new page arrives.
 */
export function RoutePending({ children, label }: { children: ReactNode; label: string }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<{ path: string; module: SkeletonModule } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const current = useRef(pathname);

  useEffect(() => {
    current.current = pathname;
    clearTimeout(timer.current);
    setPending(null);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Lets tab panels crossfade from now on (`onn-fade-in`), never on the first paint.
      document.documentElement.dataset.navigated = "";
      // Capture phase: runs before Next's Link calls preventDefault and pushes the route.
      const path = targetPath(event);
      if (!path) return;
      const from = current.current;
      clearTimeout(timer.current);
      const start = Date.now();
      void loadSkeletons().then((module) => {
        if (current.current !== from) return;
        const wait = Math.max(0, SHOW_AFTER_MS - (Date.now() - start));
        timer.current = setTimeout(() => {
          if (current.current === from) setPending({ path, module });
        }, wait);
      });
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimeout(timer.current);
    };
  }, []);

  const locale = pathname.split("/")[1] ?? "";
  const path = pending?.path.replace(new RegExp(`^/${locale}(?=/|$)`), "") ?? "";

  return (
    <>
      {pending && (
        <div aria-busy="true">
          <p role="status" className="sr-only">
            {label}
          </p>
          {pending.module.skeletonFor(path)}
        </div>
      )}
      <div hidden={Boolean(pending)}>{children}</div>
    </>
  );
}
