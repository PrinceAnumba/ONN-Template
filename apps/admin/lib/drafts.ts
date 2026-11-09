/**
 * Entry-grid drafts kept on this device (brief §7, §8: "only the entry grid drafts work
 * offline"). One record per organisation, indicator and period, holding the cells not yet saved
 * to the API. Every call fails soft: without IndexedDB (private windows, old browsers) the grid
 * still works online.
 */
import type { EntryCell } from "@onn/api-client/types";

export interface LocalDraft {
  key: string;
  cells: EntryCell[];
  /** When the cells were last changed here (ISO). */
  updated: string;
}

const DB = "onn-admin";
const STORE = "entry-drafts";

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  if (!db) return undefined;
  return new Promise<T | undefined>((resolve) => {
    try {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  }).finally(() => db.close());
}

export const draftKey = (org: string, indicator: string, period: string) =>
  `${org}|${indicator}|${period}`;

export const readDraft = (key: string) =>
  run<LocalDraft | undefined>("readonly", (store) => store.get(key));

export const writeDraft = (draft: LocalDraft) => run("readwrite", (store) => store.put(draft));

export const deleteDraft = (key: string) => run("readwrite", (store) => store.delete(key));
