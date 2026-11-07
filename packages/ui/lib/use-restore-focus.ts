"use client";

import { useRef } from "react";

/**
 * Returns focus to whatever opened a dialog. Radix's own restore can land on <body> when the
 * dialog is controlled without a Trigger, so this records the element as the dialog opens.
 * Pass the handler to `onCloseAutoFocus`.
 */
export function useRestoreFocus(open: boolean) {
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== "undefined") {
    opener.current = document.activeElement as HTMLElement | null;
  }
  wasOpen.current = open;
  return (event: Event) => {
    if (!opener.current?.isConnected) return;
    event.preventDefault();
    opener.current.focus();
  };
}
