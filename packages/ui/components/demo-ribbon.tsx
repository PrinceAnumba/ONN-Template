export function DemoRibbon({ label }: { label: string }) {
  return (
    <aside
      aria-label={label}
      className="bg-foreground pointer-events-none fixed end-[-44px] top-4 z-40 w-40 rotate-45 py-1 text-center text-xs font-semibold text-white shadow-sm rtl:-rotate-45"
    >
      {label}
    </aside>
  );
}
