"use client";

import { cn } from "@onn/ui/lib/utils";
import type { ReactNode } from "react";
import { useRestoreFocus } from "../lib/use-restore-focus";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel: string;
  side?: "left" | "right";
  children: ReactNode;
  className?: string;
}

/** Side drawer, 560 px on desktop and full screen on mobile (brief §5.3, §6). */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  side = "right",
  children,
  className,
}: DrawerProps) {
  const restoreFocus = useRestoreFocus(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        closeLabel={closeLabel}
        onCloseAutoFocus={restoreFocus}
        className={cn("w-full gap-0 sm:w-[560px]", className)}
      >
        <SheetHeader className="border-b pe-14">
          <SheetTitle className="text-h3">{title}</SheetTitle>
          <SheetDescription className={cn(!description && "sr-only")}>
            {description ?? title}
          </SheetDescription>
        </SheetHeader>
        {/* Scrollable, so it must be reachable by keyboard. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div tabIndex={0} className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
