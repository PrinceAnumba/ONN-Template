"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * A GET form that works without JavaScript; with it, any change navigates straight away and empty
 * fields stay out of the URL.
 */
export function FilterForm({
  path,
  label,
  className,
  children,
}: {
  path: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (form: HTMLFormElement) => {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value) params.append(key, value);
    }
    const search = params.toString();
    startTransition(() => router.push(`${path}${search ? `?${search}` : ""}`, { scroll: false }));
  };
  return (
    <form
      method="get"
      aria-label={label}
      aria-busy={pending}
      className={className}
      onChange={(event) => go(event.currentTarget)}
      onSubmit={(event) => {
        event.preventDefault();
        go(event.currentTarget);
      }}
    >
      {children}
    </form>
  );
}
