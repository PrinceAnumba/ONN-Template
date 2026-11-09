/** Shown while a screen's data loads on navigation; the back office has no no-JS requirement. */
export default function Loading() {
  return (
    <div aria-busy className="animate-pulse">
      <div className="bg-surface-2 h-9 w-72 max-w-full rounded-md" />
      <div className="bg-surface-2 mt-3 h-5 w-96 max-w-full rounded-md" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="bg-surface-2 h-48 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
