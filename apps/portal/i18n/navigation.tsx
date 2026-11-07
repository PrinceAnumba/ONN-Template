import { createNavigation } from "next-intl/navigation";
import type { ComponentProps } from "react";
import { routing } from "./routing";

const navigation = createNavigation(routing);

export const { redirect, usePathname, useRouter } = navigation;

/** Prefetch is off by default: on slow connections it spends data on pages nobody opened. */
export function Link(props: ComponentProps<typeof navigation.Link>) {
  return <navigation.Link prefetch={false} {...props} />;
}
