import { cn } from "@onn/ui/lib/utils";

// Same pill shapes as TargetProgress; "in collection" uses the amber frame because #B26A00 is
// under 4.5:1 for text.
const PILL: Record<string, string> = {
  published: "bg-positive text-white",
  in_collection: "border-at-risk text-foreground border-2 bg-white",
  planned: "text-foreground border-2 bg-white",
};

export function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={cn(
        "rounded-pill inline-block px-3 py-0.5 text-sm font-semibold whitespace-nowrap",
        PILL[status] ?? PILL.planned,
      )}
    >
      {label}
    </span>
  );
}
