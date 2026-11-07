import { cn } from "@onn/ui/lib/utils";
import type { ComponentProps } from "react";

/** Grey block with a 1.4 s shimmer; static under reduced motion (brief §8). */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("onn-skeleton rounded-md", className)} {...props} />;
}
