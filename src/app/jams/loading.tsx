export default function JamsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-12 md:py-12">
      <div className="mb-8 h-10 w-48 animate-pulse rounded bg-muted" />
      <div className="mb-6 h-11 w-full animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
