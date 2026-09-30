export default function SubmissionDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-12">
      <div className="mb-6 h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
      <div className="grid gap-x-10 gap-y-7 md:grid-cols-12">
        <div className="space-y-4 md:col-span-4 md:col-start-9 md:row-start-1">
          <div className="h-9 w-56 max-w-full animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="space-y-7 md:col-span-8 md:col-start-1 md:row-span-2 md:row-start-1">
          <div className="aspect-video w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="space-y-5 md:col-span-4 md:col-start-9 md:row-start-2 md:self-start">
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
