import { cn } from "@onn/ui/lib/utils";

export interface FallbackBadgeProps {
  /** "Not yet translated", in the page language. */
  label: string;
  /** The page language. Set it when the badge sits inside fallback text marked with `lang`. */
  lang?: string;
  className?: string;
}

/**
 * Marks API content shown in the default language because the page language has no text yet
 * (brief §9, `fallback: true`). Put it next to the heading or title it applies to, and give the
 * fallback text its own `lang` so screen readers switch voice.
 */
export function FallbackBadge({ label, lang, className }: FallbackBadgeProps) {
  return (
    <span
      lang={lang}
      className={cn(
        "rounded-pill text-muted-foreground inline-flex items-center border px-2 py-0.5 align-middle text-xs font-normal whitespace-nowrap",
        className,
      )}
    >
      {label}
    </span>
  );
}
