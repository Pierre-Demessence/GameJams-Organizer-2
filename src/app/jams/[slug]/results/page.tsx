import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { canRevealResults, resultsAccess } from "@/domain/results";
import { CoverImage } from "@/components/cover-image";
import { loadJamPage } from "@/lib/jam-page-queries";
import { loadResultsPage, type ResultEntry } from "@/lib/results-queries";
import {
  RESULTS_PAGE_SIZE,
  formatScore,
  ordinal,
  parseResultsParams,
  rankingView,
  resultsHref,
  unrankedScore,
  type RankingRow,
} from "@/lib/results-view";
import { cn } from "@/lib/utils";
import { JamHeader } from "../jam-header";
import { RevealResultsButton } from "./reveal-button";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadJamPage(slug, null);
  if (!data) return { title: "Results" };
  return { title: `Results — ${data.jam.name}` };
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card py-16 text-center text-muted-foreground">{children}</div>;
}

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const session = await auth();
  const data = await loadJamPage(slug, session?.user?.id ?? null);
  if (!data || !data.jam.ranked) notFound();

  const { jam, phase, viewer } = data;
  const access = resultsAccess({ ...jam, phase, canPreview: viewer.canPreviewResults });

  if (access === "none") {
    return (
      <>
        <JamHeader data={data} active="results" />
        <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 md:px-12">
          <Notice>
            {phase === "FINISHED"
              ? "The organizers will reveal the results soon."
              : "Results are published once the rating period ends."}
          </Notice>
        </div>
      </>
    );
  }

  const { results, entries, ratings } = await loadResultsPage(jam.id);
  const criteria = jam.criteria.filter((c) => c.source === "RATED");
  const query = parseResultsParams(
    await searchParams,
    criteria.map((c) => c.id),
    results.hasOverall
  );
  const view = rankingView(results, query.criterionId);
  const shown = query.all ? view.rest : view.rest.slice(0, Math.max(0, RESULTS_PAGE_SIZE - view.podium.length));
  const ranked = view.podium.length + view.rest.length;
  const canReveal = viewer.canEditJam && canRevealResults({ ...jam, phase }).allowed;

  const primary = criteria.find((c) => c.isPrimary);
  const current = criteria.find((c) => c.id === query.criterionId);
  const explain = current
    ? `${current.name} only · Bayesian-adjusted`
    : primary
      ? `Ranked by ${primary.name} · Bayesian-adjusted`
      : "Weighted average of all criteria · Bayesian-adjusted";

  const tabs = [
    ...(results.hasOverall ? [{ id: null, label: "Overall" }] : []),
    ...criteria.map((c) => ({ id: c.id, label: c.name })),
  ];

  return (
    <>
      <JamHeader data={data} active="results" />
      <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 pt-6 pb-16 md:px-12">
        {(access === "preview" || canReveal) && (
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              {access === "preview"
                ? "Organizer preview: these results are not public yet."
                : "Results are hidden from the public."}
            </p>
            {canReveal && <RevealResultsButton jamId={jam.id} />}
          </div>
        )}

        {ranked === 0 && results.notCompeting.length === 0 ? (
          <Notice>No submissions have been rated yet.</Notice>
        ) : (
          <>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <div className="relative -mx-4 md:mx-0">
                <nav
                  aria-label="Ranking criteria"
                  className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 md:gap-0.5 md:rounded-[9px] md:border md:bg-card md:p-[3px]"
                >
                  {tabs.map((t) => {
                    const on = t.id === query.criterionId;
                    return (
                      <Link
                        key={t.id ?? "overall"}
                        href={resultsHref(slug, { criterionId: t.id, all: false })}
                        aria-current={on ? "page" : undefined}
                        className={cn(
                          "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm transition-colors md:h-[30px] md:rounded-md md:border-0 md:px-3 md:text-[13px] md:font-medium",
                          on
                            ? "border-input bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {t.label}
                      </Link>
                    );
                  })}
                </nav>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background md:hidden"
                />
              </div>
              <p className="text-[13px] text-subtle-foreground">
                {explain} · <span className="font-mono">{ratings}</span> games rated
              </p>
            </div>

            {view.podium.length > 0 && (
              <ol aria-label="Podium" className="grid gap-2 md:grid-cols-3 md:gap-4">
                {view.podium.map((row) => (
                  <PodiumCard key={row.submissionId} row={row} entry={entries.get(row.submissionId)} />
                ))}
              </ol>
            )}

            {shown.length > 0 && (
              <>
                <table className="hidden w-full border-collapse text-sm md:table">
                  <thead>
                    <tr className="text-left text-xs text-subtle-foreground">
                      <th scope="col" className="w-16 border-b pb-2.5 font-medium">Rank</th>
                      <th scope="col" className="border-b pb-2.5 font-medium">Game</th>
                      <th scope="col" className="w-30 border-b pb-2.5 text-right font-medium">Score</th>
                      <th scope="col" className="w-30 border-b pb-2.5 text-right font-medium">Raw avg</th>
                      <th scope="col" className="w-25 border-b pb-2.5 text-right font-medium">Ratings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((row) => {
                      const e = entries.get(row.submissionId);
                      return (
                        <tr key={row.submissionId}>
                          <td className="border-b py-3.25 font-mono text-muted-foreground">{row.rank}</td>
                          <td className="border-b py-3.25">
                            <Link href={`/submissions/${row.submissionId}`} className="font-medium hover:text-brand">
                              {e?.title ?? "Untitled"}
                            </Link>
                            {e && e.team.length > 0 && (
                              <span className="text-subtle-foreground"> · {e.team.join(", ")}</span>
                            )}
                          </td>
                          <td className="border-b py-3.25 text-right font-mono">{formatScore(row.score)}</td>
                          <td className="border-b py-3.25 text-right font-mono text-muted-foreground">
                            {formatScore(row.raw)}
                          </td>
                          <td className="border-b py-3.25 text-right font-mono text-muted-foreground">{row.ratings}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <ol aria-label="Standings" className="border-t md:hidden">
                  {shown.map((row) => {
                    const e = entries.get(row.submissionId);
                    return (
                      <li key={row.submissionId} className="flex items-center gap-3 border-b py-3">
                        <span className="w-7 font-mono text-[13px] text-muted-foreground">{row.rank}</span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <Link
                            href={`/submissions/${row.submissionId}`}
                            className="truncate text-sm font-medium hover:text-brand"
                          >
                            {e?.title ?? "Untitled"}
                          </Link>
                          <span className="text-xs text-subtle-foreground">
                            {row.ratings} ratings · raw {formatScore(row.raw)}
                          </span>
                        </div>
                        <span className="font-mono text-sm">{formatScore(row.score)}</span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}

            {!query.all && shown.length < view.rest.length && (
              <Link
                href={resultsHref(slug, { ...query, all: true })}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-input bg-card px-4 text-sm font-medium hover:bg-muted md:h-9 md:self-center"
              >
                Show all {ranked} ranked entries
              </Link>
            )}

            {results.notCompeting.length > 0 && (
              <section aria-labelledby="not-competing" className="flex flex-col gap-2 pt-2 md:gap-3">
                <h2 id="not-competing" className="text-base font-semibold">
                  Not competing
                </h2>
                <p className="text-[13px] text-subtle-foreground">Shown for feedback; excluded from the ranking.</p>
                <ul className="border-t">
                  {results.notCompeting.map((r) => {
                    const e = entries.get(r.submissionId);
                    const score = e?.rateable ? unrankedScore(r, query.criterionId) : null;
                    return (
                      <NotCompetingRow key={r.submissionId} id={r.submissionId} entry={e} score={score} />
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

function PodiumCard({ row, entry }: { row: RankingRow; entry: ResultEntry | undefined }) {
  const title = entry?.title ?? "Untitled";
  const first = row.rank === 1;
  const badge = cn(
    "flex items-center justify-center rounded-full font-mono text-[13px] font-semibold",
    first ? "bg-rating text-background" : "bg-muted text-foreground md:bg-background"
  );
  return (
    <li
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-3 md:flex-col md:items-stretch md:gap-0 md:p-0",
        first && "border-rating"
      )}
    >
      <span className={cn(badge, "size-8.5 shrink-0 md:hidden")}>{row.rank}</span>
      <div className="relative shrink-0">
        <CoverImage
          src={entry?.coverUrl ?? null}
          alt=""
          name={title}
          className="h-10 w-14 rounded-md border text-[10px] md:h-37.5 md:w-full md:rounded-none md:border-0 md:border-b md:text-base"
        />
        <span className={cn(badge, "absolute top-3.5 left-3.5 hidden h-7 min-w-7 px-2 md:flex")}>
          {ordinal(row.rank)}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 md:items-end md:px-4.5 md:pt-4 md:pb-4.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-1">
          <Link
            href={`/submissions/${row.submissionId}`}
            className="truncate text-[15px] font-semibold after:absolute after:inset-0 hover:text-brand md:text-[17px]"
          >
            {title}
          </Link>
          {entry && entry.team.length > 0 && (
            <span className="truncate text-xs text-subtle-foreground md:text-[13px] md:text-muted-foreground">
              <span className="hidden md:inline">by </span>
              {entry.team.join(", ")}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-base font-medium md:text-[22px]">{formatScore(row.score)}</span>
          <span className="hidden text-xs text-subtle-foreground md:block">{row.ratings} ratings</span>
        </div>
      </div>
    </li>
  );
}

function NotCompetingRow({
  id,
  entry,
  score,
}: {
  id: string;
  entry: ResultEntry | undefined;
  score: number | null;
}) {
  const disqualified = entry ? !entry.rateable : false;
  const badge = disqualified ? "Disqualified" : "Not competing";
  // The moderation presets store the badge text as the default reason.
  const reason = entry?.moderationReason !== badge ? entry?.moderationReason : null;
  const scoreText = score === null ? "—" : formatScore(score);
  return (
    <li className="flex flex-col gap-1 border-b py-3 text-sm md:flex-row md:items-center md:gap-3">
      <div className="flex items-center gap-2 md:contents">
        <Link href={`/submissions/${id}`} className="flex-1 font-medium hover:text-brand md:flex-none">
          {entry?.title ?? "Untitled"}
        </Link>
        <span
          className={cn(
            "inline-flex h-5.5 items-center rounded-md border px-2 text-xs font-medium",
            disqualified ? "border-destructive text-destructive" : "border-input text-muted-foreground"
          )}
        >
          {badge}
        </span>
      </div>
      <span className="text-xs text-subtle-foreground md:flex-1 md:text-sm">
        {reason}
        {score !== null && (
          <span className="md:hidden">
            {reason && " · "}
            <span className="font-mono">{scoreText}</span>
          </span>
        )}
      </span>
      <span className="hidden font-mono text-muted-foreground md:inline">{scoreText}</span>
    </li>
  );
}
