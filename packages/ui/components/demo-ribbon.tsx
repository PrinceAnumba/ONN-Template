/** Corner ribbon shown while mocks are on. Clipped to its corner so it never widens the page. */
export function DemoRibbon({ label }: { label: string }) {
  return (
    <aside
      aria-label={label}
      className="pointer-events-none fixed end-0 top-0 z-40 size-28 overflow-hidden"
    >
      <span className="bg-foreground absolute end-[-44px] top-4 block w-40 rotate-45 py-1 text-center text-xs font-semibold text-white shadow-sm rtl:-rotate-45">
        {label}
      </span>
    </aside>
  );
}
