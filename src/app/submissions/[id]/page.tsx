import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { checkJamPermission } from "@/lib/permissions";
import { getUserRatings, loadRater } from "@/lib/rating-queries";
import { jamPhase } from "@/domain/jam-phase";
import { canRate } from "@/domain/rating";
import {
  canAddContributor,
  canEditSubmission,
  canRemoveContributor,
} from "@/domain/submission";
import { CoverImage } from "@/components/cover-image";
import { Markdown } from "@/components/markdown";
import { buttonVariants } from "@/components/ui/button-variants";
import { initials } from "@/lib/initials";
import { platformLabel } from "@/lib/jam-labels";
import { safeHttpUrl } from "@/lib/safe-url";
import { cn } from "@/lib/utils";
import { TeamManager } from "./team-manager";
import { ModerationActions } from "./moderation-actions";
import { SubmissionOwnerPanel } from "./submission-owner-panel";

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
  return { title: submission.title };
}

const STAMP = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const TAG = "inline-flex h-6 items-center rounded-full border px-2.5 text-xs";
const FULL_BUTTON = "h-11 w-full";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const submission = await db.submission.findUnique({
    where: { id },
    include: {
      jam: {
        select: {
          id: true,
          slug: true,
          name: true,
          publishedAt: true,
          startDate: true,
          endDate: true,
          ratingEnd: true,
          ranked: true,
          hideSubmissionsBeforeEnd: true,
          maxTeamSize: true,
          allowContributorsAfterClose: true,
          ratingEligibility: true,
          deletedAt: true,
          _count: { select: { criteria: true } },
        },
      },
      members: {
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { isLeader: "desc" },
      },
      fieldValues: {
        include: {
          field: { select: { id: true, name: true, isPrivate: true, type: true } },
        },
      },
    },
  });

  if (!submission) notFound();
  if (submission.jam.deletedAt) notFound();

  const status = jamPhase(submission.jam);

  // Hidden submissions only visible to team + admins/mods
  const isMember = session?.user?.id
    ? submission.members.some((m) => m.userId === session.user!.id)
    : false;

  const canModerate = session?.user?.id
    ? await checkJamPermission(
        submission.jamId,
        session.user.id,
        "edit_submission"
      )
    : false;

  if (!submission.visible && !isMember && !canModerate) notFound();
  if (submission.status === "DRAFT" && !isMember && !canModerate) notFound();

  // Respect hideSubmissionsBeforeEnd
  if (
    submission.jam.hideSubmissionsBeforeEnd &&
    (status === "ONGOING") &&
    !isMember &&
    !canModerate
  ) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          This game is hidden until the jam ends.
        </h1>
        <Link
          href={`/jams/${submission.jam.slug}`}
          className="mt-4 inline-flex min-h-11 items-center text-sm text-foreground underline underline-offset-4"
        >
          Back to {submission.jam.name}
        </Link>
      </div>
    );
  }

  const isLeader = submission.members.some(
    (m) => m.userId === session?.user?.id && m.isLeader
  );

  const canEdit = canEditSubmission({
    phase: status,
    isMember,
    canEditAny: canModerate,
  }).allowed;

  const showRateButton =
    !!session?.user?.id &&
    canRate({
      phase: status,
      ranked: submission.jam.ranked,
      eligibility: submission.jam.ratingEligibility,
      rater: await loadRater(submission.jamId, session.user.id),
      isOwnSubmission: isMember,
      submission,
    }).allowed;

  // Only the viewer's own ratings are read; ratings stay anonymous (spec §6.3).
  const hasRated = session?.user?.id
    ? (await getUserRatings(submission.id, session.user.id)).length > 0
    : false;
  const showRatingCard = showRateButton || hasRated;

  const teamContext = {
    phase: status,
    ranked: submission.jam.ranked,
    allowContributorsAfterClose: submission.jam.allowContributorsAfterClose,
    isMember,
  };
  const canAddMembers = canAddContributor({
    ...teamContext,
    teamSize: submission.members.length,
    maxTeamSize: submission.jam.maxTeamSize,
  }).allowed;
  const canRemoveMembers = canRemoveContributor({
    ...teamContext,
    targetIsLeader: false,
  }).allowed;

  // Filter private fields for non-organizers
  const visibleFields = submission.fieldValues.filter(
    (fv) => !fv.field.isPrivate || canModerate
  );

  const jam = submission.jam;
  const videoUrl = safeHttpUrl(submission.videoUrl);
  const screenshots = submission.screenshots.flatMap((u) => safeHttpUrl(u) ?? []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex flex-wrap items-center gap-x-2 text-sm text-subtle-foreground"
      >
        <Link href={`/jams/${jam.slug}`} className="inline-flex min-h-11 items-center hover:text-foreground md:min-h-0">
          {jam.name}
        </Link>
        <span aria-hidden>/</span>
        <Link
          href={`/jams/${jam.slug}/submissions`}
          className="inline-flex min-h-11 items-center hover:text-foreground md:min-h-0"
        >
          Submissions
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">{submission.title}</span>
      </nav>

      <div className="grid gap-x-10 gap-y-7 md:grid-cols-12">
        {/* Title block leads on mobile and sits at the top of the aside on desktop. */}
        <div className="flex flex-col gap-4 md:col-span-4 md:col-start-9 md:row-start-1">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{submission.title}</h1>
            <div className="flex flex-wrap gap-2">
              {submission.status === "DRAFT" && (
                <span className={cn(TAG, "border-dashed text-muted-foreground")}>Draft</span>
              )}
              {!submission.competing && !submission.rateable && (
                <span className={cn(TAG, "border-destructive text-destructive")}>Disqualified</span>
              )}
              {!submission.competing && submission.rateable && (
                <span className={cn(TAG, "text-muted-foreground")}>Not competing</span>
              )}
              {!submission.visible && <span className={cn(TAG, "text-muted-foreground")}>Hidden</span>}
            </div>
          </div>
          {submission.itchUrl && (
            <a
              href={submission.itchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants(), FULL_BUTTON)}
            >
              Play on itch.io ↗
            </a>
          )}
          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), FULL_BUTTON)}
            >
              Watch the video
            </a>
          )}
          {canEdit && (
            <Link
              href={`/submissions/${submission.id}/edit`}
              className={cn(buttonVariants({ variant: "outline" }), "h-10 min-h-11 w-full md:min-h-10")}
            >
              Edit
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-7 md:col-span-8 md:col-start-1 md:row-span-2 md:row-start-1">
          <CoverImage
            src={submission.coverUrl}
            alt={`Cover image of ${submission.title}`}
            name={submission.title}
            className="aspect-video w-full rounded-xl border"
          />

          {screenshots.length > 0 && (
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
              {screenshots.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-40 shrink-0 md:w-auto"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Screenshot ${i + 1} of ${submission.title}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-24 w-full rounded-lg border object-cover"
                  />
                </a>
              ))}
            </div>
          )}

          {submission.description && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold tracking-tight">About the game</h2>
              <Markdown>{submission.description}</Markdown>
            </section>
          )}

          {visibleFields.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Submission info</h2>
              <dl className="overflow-hidden rounded-xl border">
                {visibleFields.map((fv) => (
                  <div key={fv.id} className="flex flex-col gap-1 border-b p-4 last:border-b-0 md:flex-row md:gap-6">
                    <dt className="text-sm text-muted-foreground md:w-48 md:shrink-0">
                      {fv.field.name}
                      {fv.field.isPrivate && (
                        <span className="ml-2 rounded border px-1.5 text-[11px]">Private</span>
                      )}
                    </dt>
                    <dd className="min-w-0 text-sm wrap-break-word whitespace-pre-wrap">
                      {fv.field.type === "URL" ? (
                        <a
                          href={fv.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {fv.value}
                        </a>
                      ) : (
                        fv.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-5 md:col-span-4 md:col-start-9 md:row-start-2 md:self-start">
          <dl>
            {submission.supportedPlatforms.length > 0 && (
              <div className="flex justify-between gap-4 border-b py-2.5 text-sm">
                <dt className="text-muted-foreground">Platforms</dt>
                <dd className="flex flex-wrap justify-end gap-1">
                  {submission.supportedPlatforms.map((p) => (
                    <span key={p} className="rounded border px-1.5 font-mono text-[11px]">
                      {platformLabel(p)}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-b py-2.5 text-sm">
              <dt className="text-muted-foreground">Jam</dt>
              <dd>
                <Link href={`/jams/${jam.slug}`} className="hover:underline">
                  {jam.name}
                </Link>
              </dd>
            </div>
          </dl>

          <section aria-label="Team" className="flex flex-col gap-1">
            <h2 className="text-sm text-subtle-foreground">Team</h2>
            <ul>
              {submission.members.map((m) => {
                const name = m.user.displayName ?? m.user.username;
                return (
                  <li key={m.id} className="flex items-center gap-3 py-1">
                    {m.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.user.avatarUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="size-8 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-subtle-foreground"
                      >
                        {initials(name)}
                      </span>
                    )}
                    <div className="flex min-h-11 flex-col justify-center md:min-h-0">
                      <Link href={`/users/${m.user.username}`} className="text-sm hover:underline">
                        {name}
                      </Link>
                      <span className="text-xs text-subtle-foreground">@{m.user.username}</span>
                    </div>
                    {m.isLeader && (
                      <span className="ml-auto text-xs text-muted-foreground">Leader</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {showRatingCard && (
            <section aria-label="Your rating" className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <h2 className="text-sm text-subtle-foreground">Your rating</h2>
              {jam.ratingEnd && showRateButton && (
                <p className="font-mono text-xs text-rating">Open until {STAMP.format(jam.ratingEnd)} UTC</p>
              )}
              {hasRated ? (
                <>
                  <p className="text-sm text-muted-foreground">You rated this game.</p>
                  {showRateButton && (
                    <Link
                      href={`/submissions/${submission.id}/rate`}
                      className={cn(buttonVariants({ variant: "outline" }), "h-10 min-h-11 w-full md:min-h-10")}
                    >
                      Change your rating
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Not rated yet. Play the game first, then score it on {jam._count.criteria} criteria.
                    Ratings are anonymous.
                  </p>
                  <Link
                    href={`/submissions/${submission.id}/rate`}
                    className={cn(buttonVariants(), "h-10 min-h-11 w-full md:min-h-10")}
                  >
                    Rate {submission.title}
                  </Link>
                </>
              )}
            </section>
          )}

          {isMember && (
            <SubmissionOwnerPanel
              submissionId={submission.id}
              status={submission.status}
              itchUrl={submission.itchUrl}
              verificationCode={submission.verificationCode}
              verified={submission.verified}
              canFinalize={status === "ONGOING"}
            />
          )}

          {isMember && (canAddMembers || canRemoveMembers) && (
            <TeamManager
              submissionId={submission.id}
              canAdd={canAddMembers}
              canRemove={canRemoveMembers}
              canTransfer={isLeader}
              members={submission.members.map((m) => ({
                id: m.id,
                userId: m.user.id,
                username: m.user.username,
                displayName: m.user.displayName,
                isLeader: m.isLeader,
              }))}
              maxTeamSize={jam.maxTeamSize}
            />
          )}

          {canModerate && (
            <ModerationActions
              submissionId={submission.id}
              visible={submission.visible}
              rateable={submission.rateable}
              competing={submission.competing}
              verified={submission.verified}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
