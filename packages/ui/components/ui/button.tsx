import { cn } from "@onn/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";

// Brief §6: variants primary, secondary, ghost, danger; 36 / 44 / 48 px; radius 6 px;
// hover darkens 8 %; active scale(.98); disabled 45 % opacity; loading keeps the width.
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap",
    "transition-[background-color,transform] duration-(--onn-dur-1) ease-onn active:scale-[.98]",
    "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    "motion-reduce:transition-none motion-reduce:active:scale-100",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary)_92%,black)]",
        secondary:
          "bg-background text-foreground border hover:bg-[color-mix(in_oklch,var(--background)_92%,black)]",
        ghost: "text-foreground hover:bg-[color-mix(in_oklch,var(--background)_92%,black)]",
        danger:
          "bg-destructive hover:bg-[color-mix(in_oklch,var(--destructive)_92%,black)] text-white",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4",
        lg: "h-12 px-6",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="inline-flex items-center gap-2 opacity-0">{children}</span>
          <span aria-hidden className="absolute inset-0 flex items-center justify-center">
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
          </span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
