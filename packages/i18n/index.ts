export type Messages = typeof import("./messages/en.json");

const catalogues: Record<string, () => Promise<{ default: Messages }>> = {
  en: () => import("./messages/en.json"),
  fr: () => import("./messages/fr.json"),
  wo: () => import("./messages/wo.json"),
};

export async function loadMessages(locale: string): Promise<Messages> {
  const load = catalogues[locale];
  if (!load) throw new Error(`No messages for locale "${locale}"`);
  return (await load()).default;
}

/** Namespaces every page sends to client components. */
export const CLIENT_NAMESPACES = [
  "Common",
  "Nav",
  "Header",
  "Palette",
  "Selector",
  "Footer",
  "Errors",
  "Offline",
] as const satisfies (keyof Messages)[];

/** Namespaces client components need; everything else stays on the server. */
export function pickMessages(messages: Messages, namespaces: (keyof Messages)[]) {
  return Object.fromEntries(namespaces.map((name) => [name, messages[name]]));
}
