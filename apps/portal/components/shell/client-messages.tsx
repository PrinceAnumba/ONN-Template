import { CLIENT_NAMESPACES, pickMessages, type Messages } from "@onn/i18n";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

/**
 * Adds message namespaces for one client island, so pages that don't use them never ship them.
 * A nested provider replaces its parent's messages, so the shared namespaces are repeated.
 */
export async function ClientMessages({
  namespaces,
  children,
}: {
  namespaces: (keyof Messages)[];
  children: ReactNode;
}) {
  const messages = (await getMessages()) as Messages;
  return (
    <NextIntlClientProvider
      messages={pickMessages(messages, [...CLIENT_NAMESPACES, ...namespaces])}
    >
      {children}
    </NextIntlClientProvider>
  );
}
