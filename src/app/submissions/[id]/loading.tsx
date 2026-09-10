export default function SubmissionDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-2 h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="h-9 w-56 animate-pulse rounded bg-muted" />
        <div className="h-10 w-20 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-4">
        <div className="h-40 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
