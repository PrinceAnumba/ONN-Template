"use client";

import { LiteModeToggle } from "@onn/ui/components/lite-mode-toggle";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LITE_COOKIE, liteCookie } from "@/lib/lite-cookie";

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

const SLOW = new Set(["slow-2g", "2g", "3g"]);

export interface LiteToggleProps {
  on: boolean;
  /** The route handler that sets the cookie when JavaScript is off. */
  action: string;
  label: string;
  description: string;
}

/**
 * Footer Lite switch (brief §9). A form that posts to the route handler without JavaScript; with
 * it, sets the cookie and refreshes so the server renders the other mode. With no cookie yet, a
 * slow connection or data saver turns Lite on (Chromium only: WebKit has no navigator.connection).
 */
export function LiteToggle({ on, action, label, description }: LiteToggleProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(on);
  const [, startTransition] = useTransition();

  const apply = (next: boolean) => {
    document.cookie = liteCookie(next);
    setChecked(next);
    startTransition(() => router.refresh());
  };

  useEffect(() => {
    if (on || document.cookie.split("; ").some((item) => item.startsWith(`${LITE_COOKIE}=`))) {
      return;
    }
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (connection?.saveData || SLOW.has(connection?.effectiveType ?? "")) apply(true);
    // Once, on first load; `apply` only touches the cookie, state and router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form
      method="post"
      action={action}
      onSubmit={(event) => {
        event.preventDefault();
        apply(!checked);
      }}
      className="mt-6"
    >
      <input type="hidden" name="lite" value={checked ? "0" : "1"} />
      <LiteModeToggle submit checked={checked} label={label} description={description} />
    </form>
  );
}
