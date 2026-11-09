"use client";

import { useEffect } from "react";

/** Message an embedding page can listen for to size its iframe to the content. */
export const EMBED_HEIGHT_MESSAGE = "onn-embed-height";

/**
 * Tells the page around an embed how tall the content is, whenever it changes, so iframes don't
 * need a fixed height. Only the height is sent, so any origin may receive it.
 */
export function EmbedHeight() {
  useEffect(() => {
    if (window.parent === window) return;
    let last = 0;
    const send = () => {
      const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
      if (height === last) return;
      last = height;
      window.parent.postMessage({ type: EMBED_HEIGHT_MESSAGE, height }, "*");
    };
    const observer = new ResizeObserver(send);
    observer.observe(document.body);
    send();
    return () => observer.disconnect();
  }, []);
  return null;
}
