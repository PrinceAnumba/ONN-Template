"use client";

import { cn } from "@onn/ui/lib/utils";
import { XIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import * as React from "react";
import { useRestoreFocus } from "../lib/use-restore-focus";

/** Snap points as "96px" or "50%" of the viewport height. */
export type SnapPoint = `${number}px` | `${number}%`;

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  /** Names the drag handle, which also cycles the snap points from the keyboard. */
  handleLabel: string;
  snapPoints?: SnapPoint[];
  snap?: number;
  onSnapChange?: (index: number) => void;
  /** Off for a map panel, so the map stays usable behind the peek state. */
  modal?: boolean;
  children: React.ReactNode;
}

const DEFAULT_SNAPS: SnapPoint[] = ["96px", "50%", "92%"];

function toPixels(point: SnapPoint, viewport: number) {
  const amount = parseFloat(point);
  return point.endsWith("%") ? (amount / 100) * viewport : amount;
}

export function nearestSnap(height: number, snaps: SnapPoint[], viewport: number) {
  let best = 0;
  snaps.forEach((point, i) => {
    const distance = Math.abs(toPixels(point, viewport) - height);
    if (distance < Math.abs(toPixels(snaps[best]!, viewport) - height)) best = i;
  });
  return best;
}

/** Bottom sheet with drag-to-snap (brief §5.4, §6). Built on Radix Dialog for focus and Esc. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  closeLabel,
  handleLabel,
  snapPoints = DEFAULT_SNAPS,
  snap: controlledSnap,
  onSnapChange,
  modal = true,
  children,
}: BottomSheetProps) {
  const [uncontrolledSnap, setUncontrolledSnap] = React.useState(0);
  const snap = controlledSnap ?? uncontrolledSnap;
  const setSnap = (index: number) => {
    setUncontrolledSnap(index);
    onSnapChange?.(index);
  };
  const [dragHeight, setDragHeight] = React.useState<number | null>(null);
  const drag = React.useRef<{ startY: number; startHeight: number } | null>(null);
  const restoreFocus = useRestoreFocus(open);

  const viewport = () => (typeof window === "undefined" ? 800 : window.innerHeight);
  const height = dragHeight ?? toPixels(snapPoints[snap] ?? snapPoints[0]!, viewport());

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startHeight: height };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    const next = drag.current.startHeight + (drag.current.startY - event.clientY);
    setDragHeight(Math.min(Math.max(next, 48), viewport()));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const moved = dragHeight !== null && Math.abs(dragHeight - drag.current.startHeight) > 4;
    drag.current = null;
    if (moved) setSnap(nearestSnap(dragHeight, snapPoints, viewport()));
    else setSnap((snap + 1) % snapPoints.length);
    setDragHeight(null);
  };
  const onHandleKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowUp") setSnap(Math.min(snap + 1, snapPoints.length - 1));
    else if (event.key === "ArrowDown") setSnap(Math.max(snap - 1, 0));
    else return;
    event.preventDefault();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <Dialog.Portal>
        {modal && (
          <Dialog.Overlay className="bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 motion-reduce:animate-none" />
        )}
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={restoreFocus}
          onInteractOutside={(event) => {
            if (!modal) event.preventDefault();
          }}
          style={{ height }}
          className={cn(
            "bg-background fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-lg border-t shadow-md",
            // Slides up on open and down on close (brief §8); base.css removes it under reduced motion.
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom ease-onn duration-(--onn-dur-3)",
            dragHeight === null &&
              "transition-[height] duration-(--onn-dur-3) ease-onn motion-reduce:transition-none",
          )}
        >
          <button
            type="button"
            aria-label={handleLabel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={onHandleKey}
            className="flex h-6 w-full shrink-0 cursor-grab touch-none items-center justify-center"
          >
            <span aria-hidden className="bg-border h-1.5 w-10 rounded-full" />
          </button>
          <div className="flex items-start justify-between gap-2 px-4">
            <Dialog.Title className="text-h3">{title}</Dialog.Title>
            <Dialog.Close
              aria-label={closeLabel}
              className="-mt-2 flex size-11 shrink-0 items-center justify-center rounded-md"
            >
              <XIcon aria-hidden className="size-5" />
            </Dialog.Close>
          </div>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div tabIndex={0} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
