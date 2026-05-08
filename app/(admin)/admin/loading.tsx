/**
 * Shown immediately while the next admin page's server components are
 * fetching. Stops the UI feeling frozen on slow networks / cold starts —
 * the user sees the chrome stay put with a skeleton in the main area
 * instead of a stalled click.
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-bg-subtle" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-[12px] border border-border bg-bg"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[12px] border border-border bg-bg" />
    </div>
  );
}
