import { Suspense } from "react";
import Link from "next/link";
import { JamCard } from "@/components/jam/jam-card";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  JAM_LIST_PAGE_SIZE,
  jamListHref,
  parseJamListParams,
  type JamListParams,
  type ListStatus,
} from "@/lib/jam-list-params";
import { loadJamList } from "@/lib/jam-list-queries";
import { cn } from "@/lib/utils";
import { JamFilters } from "./jam-filters";

export const metadata = {
  title: "Jams",
  description: "Browse game jams",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_TABS: { status: ListStatus; label: string }[] = [
  { status: "all", label: "All" },
  { status: "live", label: "Live" },
  { status: "upcoming", label: "Upcoming" },
  { status: "rating", label: "Rating" },
  { status: "finished", label: "Finished" },
];

export default function JamsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-12 md:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Jams</h1>
          <p className="mt-1 text-muted-foreground">
            Find something to build this weekend — or next month.
          </p>
        </div>
        <Link href="/jams/new" className={cn(buttonVariants(), "h-10 min-h-11 px-4 md:min-h-10")}>
          Host a jam
        </Link>
      </div>
      <Suspense fallback={<JamsBodySkeleton />}>
        <JamsBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function JamsBodySkeleton() {
  return (
    <>
      <div className="mb-6 h-11 w-full animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </>
  );
}

async function JamsBody({ searchParams }: { searchParams: SearchParams }) {
  const params = parseJamListParams(await searchParams);
  const list = await loadJamList(params);
  const now = new Date();

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b pb-5">
        <nav
          aria-label="Jam status"
          className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-card p-1"
        >
          {STATUS_TABS.map(({ status, label }) => {
            const active = params.status === status;
            return (
              <Link
                key={status}
                href={jamListHref(params, { status })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm transition-colors md:min-h-8",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
                <span className="font-mono text-xs text-subtle-foreground">{list.counts[status]}</span>
              </Link>
            );
          })}
        </nav>
        <SearchForm params={params} />
        <JamFilters params={params} />
      </div>

      {list.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 py-4">
          <span className="text-sm text-subtle-foreground">Tags</span>
          {list.tags.map((tag) => {
            const active = params.tag === tag;
            return (
              <Link
                key={tag}
                href={jamListHref(params, { tag: active ? "" : tag })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-3 text-xs transition-colors md:min-h-7",
                  active
                    ? "border-foreground text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tag}
              </Link>
            );
          })}
        </div>
      )}

      {list.jams.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">No jams match these filters.</p>
          <Link
            href="/jams"
            className="mt-3 inline-flex min-h-11 items-center text-sm text-foreground underline underline-offset-4"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.jams.map((jam) => (
            <JamCard key={jam.id} jam={jam} now={now} />
          ))}
        </div>
      )}

      {list.hasMore && (
        <div className="mt-8 flex justify-center">
          <Link
            href={jamListHref(params, { show: params.show + JAM_LIST_PAGE_SIZE })}
            scroll={false}
            className={cn(buttonVariants({ variant: "outline" }), "h-10 min-h-11 px-4 md:min-h-10")}
          >
            Load more
          </Link>
        </div>
      )}
    </>
  );
}

// GET form: the query string is the state, so search works without client JS.
function SearchForm({ params }: { params: JamListParams }) {
  const hidden: [string, string][] = [];
  if (params.status !== "all") hidden.push(["status", params.status]);
  if (params.tag) hidden.push(["tag", params.tag]);
  if (params.format !== "any") hidden.push(["format", params.format]);
  if (params.sort !== "relevant") hidden.push(["sort", params.sort]);
  return (
    <form action="/jams" method="GET" role="search" className="flex-1 md:max-w-xs">
      <label className="sr-only" htmlFor="jam-search">
        Search jams
      </label>
      <input
        id="jam-search"
        type="search"
        name="q"
        defaultValue={params.q}
        maxLength={100}
        placeholder="Search jams"
        className="min-h-11 w-full rounded-lg border border-input bg-card px-3 text-sm md:h-10 md:min-h-10"
      />
      {hidden.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </form>
  );
}
