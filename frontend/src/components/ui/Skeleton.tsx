/**
 * Loading placeholders.
 *
 * Every page used to greet you with the word "Loading…" centred in an empty
 * window, which tells you nothing about what is coming. A skeleton in the
 * shape of the real thing makes the wait feel shorter and stops the layout
 * jumping when the data lands.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse-soft rounded-md bg-surface-sunken ${className}`} />
  );
}

/** A stand-in for one card in a list or grid. */
export function SkeletonCard() {
  return (
    <div className="card space-y-3 p-4">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-2.5 w-full" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

/** The whole page while its first fetch is in flight. */
export function SkeletonPage({ cards = 4 }: { cards?: number }) {
  return (
    <div
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6"
      role="status"
      aria-label="Loading"
    >
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
