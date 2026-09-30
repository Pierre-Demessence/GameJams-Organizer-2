export default function JamDetailLoading() {
  return (
    <div>
      <div className="h-36 w-full animate-pulse bg-muted md:h-56" />
      <div className="mx-auto max-w-7xl px-4 md:px-12">
        <div className="-mt-8 flex flex-col gap-4 pb-6 md:-mt-11 md:flex-row md:items-end md:gap-6">
          <div className="size-16 animate-pulse rounded-2xl bg-muted md:size-22" />
          <div className="space-y-2">
            <div className="h-9 w-64 max-w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="mb-6 h-28 animate-pulse rounded-xl bg-muted" />
        <div className="h-11 animate-pulse rounded bg-muted" />
        <div className="grid gap-10 pt-8 md:grid-cols-12">
          <div className="space-y-6 md:col-span-8">
            <div className="h-28 animate-pulse rounded-xl bg-muted" />
            <div className="h-48 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="space-y-6 md:col-span-4">
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
