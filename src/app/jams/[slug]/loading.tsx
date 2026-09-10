export default function JamDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-6">
        <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
