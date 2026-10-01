import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getUserRatings, loadRater } from "@/lib/rating-queries";
import { canRate } from "@/domain/rating";
import { CoverImage } from "@/components/cover-image";
import { Countdown } from "@/components/jam/countdown";
import { buttonVariants } from "@/components/ui/button-variants";
import { loadJamPage } from "@/lib/jam-page-queries";
import { loadJamEntries } from "@/lib/jam-entries-queries";
import { nextToRate, parseEntriesParams } from "@/lib/jam-entries";
import { platformLabel } from "@/lib/jam-labels";
import { safeHttpUrl } from "@/lib/safe-url";
import { cn } from "@/lib/utils";
import { RatingForm } from "./rating-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = await db.submission.findUnique({
    where: { id },
    select: { title: true, jam: { select: { deletedAt: true } } },
  });
  if (!submission || submission.jam.deletedAt)
    return { title: "Submission Not Found" };
  return { title: `Rate ${submission.title}` };
}

export default async function RateSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const submission = await db.submission.findUnique({
    where: { id },
    select: {
      id: true,
      jamId: true,
      title: true,
      coverUrl: true,
      itchUrl: true,
      supportedPlatforms: true,
      status: true,
      rateable: true,
      jam: { select: { slug: true, deletedAt: true } },
      members: {
        select: { userId: true, user: { select: { username: true, displayName: true } } },
        orderBy: { isLeader: "desc" },
      },
    },
  });
  if (!submission || submission.jam.deletedAt) notFound();

  // Also hides DRAFT jams from anyone without a role on them.
  const data = await loadJamPage(submission.jam.slug, userId);
  if (!data || data.phase === "DRAFT") notFound();
  const { jam, phase } = data;

  const decision = canRate({
    phase,
    ranked: jam.ranked,
    eligibility: jam.ratingEligibility,
    rater: await loadRater(submission.jamId, userId),
    isOwnSubmission: submission.members.some((m) => m.userId === userId),
    submission,
  });
  if (!decision.allowed) {
    return (
      <div className="mx-auto max-w-190 px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Cannot rate</h1>
        <p className="mt-2 text-muted-foreground">{decision.reason}</p>
        <Link
          href={`/submissions/${id}`}
          className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
        >
          Back to {submission.title}
        </Link>
      </div>
    );
  }

  const [list, existingRatings] = await Promise.all([
    loadJamEntries(data, parseEntriesParams({}, phase)),
    getUserRatings(id, userId),
  ]);
  const next = nextToRate(list.entries.filter((e) => e.id !== id));
  const criteria = jam.criteria.filter((c) => c.source === "RATED");
  const playUrl = safeHttpUrl(submission.itchUrl);
  const team = submission.members.map((m) => m.user.displayName ?? m.user.username);
  const byline = [
    team.length > 0 ? `by ${team.join(", ")}` : null,
    submission.supportedPlatforms.map(platformLabel).join(", ") || null,
  ]
    .filter(Boolean)
    .join(" · ");
  const closesIn = jam.ratingEnd ? (
    <Countdown to={jam.ratingEnd.toISOString()} className="text-foreground" />
  ) : null;

  return (
    <div className="mx-auto flex max-w-190 flex-col gap-4 px-4 pt-4 pb-6 md:gap-6 md:px-0 md:pt-10 md:pb-16">
      <div className="flex items-center justify-between gap-4 text-[13px] text-subtle-foreground">
        <Link
          href={`/jams/${jam.slug}/submissions`}
          className="hidden min-h-8 items-center hover:text-foreground md:inline-flex"
        >
          ← {jam.name}
        </Link>
        <Link href={`/submissions/${id}`} className="inline-flex min-h-8 items-center hover:text-foreground md:hidden">
          ← {submission.title}
        </Link>
        {list.progress && (
          <span>
            <span className="font-mono">
              {list.progress.rated} / {list.progress.eligible}
            </span>{" "}
            rated
            {closesIn && <span className="hidden md:inline"> · closes in {closesIn}</span>}
          </span>
        )}
      </div>

      <section className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4.5 md:rounded-xl md:border md:bg-card md:p-4">
        <CoverImage
          src={submission.coverUrl}
          alt=""
          name={submission.title}
          className="hidden h-18 w-32 shrink-0 rounded-lg border text-sm md:flex"
        />
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-[22px]">Rate “{submission.title}”</h1>
          {byline && <p className="hidden text-sm text-muted-foreground md:block">{byline}</p>}
          <p className="text-[13px] text-muted-foreground md:hidden">
            Anonymous · editable until rating closes{closesIn && <> in {closesIn}</>}
          </p>
        </div>
        {playUrl && (
          <a
            href={playUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-2 h-11 gap-1.5 px-3.5 md:mt-0 md:h-9.5"
            )}
          >
            Play on itch.io
            <ArrowUpRight aria-hidden className="size-3.5" />
          </a>
        )}
      </section>

      <RatingForm
        submissionId={id}
        criteria={criteria}
        existingRatings={existingRatings}
        nextHref={next ? `/submissions/${next}/rate` : null}
      />
    </div>
  );
}
