import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { CoverImage } from "@/components/cover-image";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  PLATFORMS,
  entriesHref,
  parseEntriesParams,
  type EntriesParams,
  type EntriesSort,
} from "@/lib/jam-entries";
import { loadJamEntries, type EntryCard } from "@/lib/jam-entries-queries";
import { platformLabel } from "@/lib/jam-labels";
import { loadJamPage } from "@/lib/jam-page-queries";
import { cn } from "@/lib/utils";
import { JamHeader } from "../jam-header";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadJamPage(slug, null);
  if (!data) return { title: "Jam Not Found" };
  return { title: `Submissions — ${data.jam.name}` };
}

const CHIP =
  "inline-flex min-h-11 items-center rounded-full border px-3 text-xs transition-colors md:min-h-8";
const chipState = (on: boolean) =>
  on ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground";

const SORT_LABELS: Record<EntriesSort, string> = {
  fewest: "Fewest ratings",
  newest: "Newest",
  title: "Title",
};

export default async function JamSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const session = await auth();
  const data = await loadJamPage(slug, session?.user?.id ?? null);
  if (!data) notFound();

  const { phase } = data;
  const query = parseEntriesParams(await searchParams, phase);
  const list = await loadJamEntries(data, query);
  const rating = phase === "RATING";
  const href = (change: Partial<EntriesParams>) => entriesHref(slug, phase, query, change);
  const filtered = query.platforms.length > 0 || query.hideRated;
  const sorts: EntriesSort[] = rating ? ["fewest", "newest", "title"] : ["newest", "title"];

  return (
    <>
      <JamHeader data={data} active="submissions" />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-6 pb-16 md:px-12">
        {list.progress && (
          <section
            aria-label="Your rating progress"
            className="flex flex-col gap-4 rounded-xl border bg-card p-5 md:flex-row md:items-center md:gap-8"
          >
            <div className="flex-1">
              <p className="text-sm">
                You&apos;ve rated <span className="font-mono">{list.progress.rated}</span> of{" "}
                <span className="font-mono">{list.progress.eligible}</span> eligible entries
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-track">
                <div
                  className="h-full bg-rating"
                  style={{ width: `${(list.progress.rated / list.progress.eligible) * 100}%` }}
                />
              </div>
            </div>
            {list.progress.next ? (
              <Link
                href={`/submissions/${list.progress.next}/rate`}
                className={cn(buttonVariants(), "h-10 min-h-11 px-4 md:min-h-10")}
              >
                Rate next game →
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">You&apos;ve rated every game you can. Thanks!</p>
            )}
          </section>
        )}

        {!list.hidden && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-subtle-foreground">Plays on</span>
              {PLATFORMS.map((p) => {
                const on = query.platforms.includes(p);
                const platforms = on ? query.platforms.filter((x) => x !== p) : [...query.platforms, p];
                return (
                  <Link
                    key={p}
                    href={href({ platforms })}
                    aria-current={on ? "true" : undefined}
                    className={cn(CHIP, chipState(on))}
                  >
                    {platformLabel(p)}
                  </Link>
                );
              })}
              {rating && (
                <Link
                  href={href({ hideRated: !query.hideRated })}
                  aria-current={query.hideRated ? "true" : undefined}
                  className={cn(CHIP, chipState(query.hideRated))}
                >
                  Hide games I&apos;ve rated
                </Link>
              )}
            </div>
            <nav aria-label="Sort submissions" className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-subtle-foreground">Sort</span>
              {sorts.map((s) => (
                <Link
                  key={s}
                  href={href({ sort: s })}
                  aria-current={query.sort === s ? "true" : undefined}
                  className={cn(CHIP, chipState(query.sort === s))}
                >
                  {SORT_LABELS[s]}
                </Link>
              ))}
            </nav>
          </div>
        )}

        {list.hidden ? (
          <div className="rounded-xl border bg-card py-16 text-center text-muted-foreground">
            Submissions are hidden until the jam ends.
          </div>
        ) : (
          <>
            {list.ownOnly && (
              <p className="text-sm text-muted-foreground">
                Only your entry is shown. Other games are hidden until the jam ends.
              </p>
            )}
            {list.entries.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                {filtered ? (
                  <>
                    <p>No games match these filters.</p>
                    <Link
                      href={`/jams/${slug}/submissions`}
                      className="mt-3 inline-flex min-h-11 items-center text-sm text-foreground underline underline-offset-4"
                    >
                      Clear filters
                    </Link>
                  </>
                ) : (
                  <p>No submissions yet.</p>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {list.entries.map((e) => (
                  <EntryTile key={e.id} entry={e} rating={rating} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function EntryTile({ entry, rating }: { entry: EntryCard; rating: boolean }) {
  const leader = entry.team.find((m) => m.isLeader) ?? entry.team[0];
  const extra = entry.team.length - 1;
  return (
    <article className="relative flex flex-col overflow-hidden rounded-xl border bg-card">
      <CoverImage src={entry.coverUrl} alt="" name={entry.title} className="h-36 w-full border-b" />
      <div className="flex grow flex-col gap-2 p-4">
        <Link href={`/submissions/${entry.id}`} className="font-semibold after:absolute after:inset-0">
          {entry.title}
        </Link>
        {leader && (
          <p className="text-sm text-muted-foreground">
            by {leader.displayName ?? leader.username}
            {extra > 0 && ` +${extra}`}
          </p>
        )}
        {!entry.competing && (
          <div className="flex">
            <span className="rounded border px-1.5 text-[11px] text-muted-foreground">
              {entry.rateable ? "Not competing" : "Disqualified"}
            </span>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap gap-1">
            {entry.platforms.map((p) => (
              <span key={p} className="rounded border px-1.5 font-mono text-[11px] text-muted-foreground">
                {platformLabel(p)}
              </span>
            ))}
          </div>
          {entry.isViewerTeam ? (
            <span className="text-xs text-brand">Your team</span>
          ) : entry.ratedByViewer ? (
            <span className="text-xs text-live">✓ Rated</span>
          ) : rating ? (
            <span className="font-mono text-xs text-subtle-foreground">{entry.raters} ratings</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
