// Forms sent while offline wait here until the site is open and online again (brief §8). Kept
// in localStorage rather than Background Sync: WebKit has no Background Sync, and a queued Server
// Action request can't be replayed after a deploy changes its id.

const KEY = "onn-outbox";
export const OUTBOX_EVENT = "onn-outbox";

export type OutboxItem =
  | { id: string; kind: "feedback"; fields: Record<string, string> }
  | { id: string; kind: "subscribe"; email: string; locale: string };

export function readOutbox(): OutboxItem[] {
  try {
    const items: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(items) ? (items as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  try {
    if (items.length) localStorage.setItem(KEY, JSON.stringify(items));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private mode): the form shows its normal offline error instead.
  }
}

/** An outbox item before it has an id (Omit applied to each member of the union). */
export type NewOutboxItem = OutboxItem extends infer T
  ? T extends OutboxItem
    ? Omit<T, "id">
    : never
  : never;

/** Saves a form for later. Returns false when storage is unavailable. */
export function queueForm(item: NewOutboxItem): boolean {
  const next = [...readOutbox(), { ...item, id: crypto.randomUUID() } as OutboxItem];
  write(next);
  const saved = readOutbox().length === next.length;
  if (saved) window.dispatchEvent(new Event(OUTBOX_EVENT));
  return saved;
}

export function removeFromOutbox(id: string) {
  write(readOutbox().filter((item) => item.id !== id));
}

/** True when a request failed for lack of a connection (or timed out) rather than a server answer. */
export function isOffline(error?: unknown) {
  return (
    !navigator.onLine ||
    error instanceof TypeError ||
    (error instanceof DOMException && error.name === "TimeoutError")
  );
}
