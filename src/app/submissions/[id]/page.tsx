import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { computeJamStatus } from "@/lib/jam-status";
import { checkJamPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    select: { title: true },
  });
  if (!submission) return { title: "Submission Not Found" };
  return { title: submission.title };
}

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
          startDate: true,
          endDate: true,
          ratingEnd: true,
          ranked: true,
          hideSubmissionsBeforeEnd: true,
          maxTeamSize: true,
          allowContributorsAfterClose: true,
        },
      },
      members: {
        include: { user: { select: { id: true, username: true, displayName: true } } },
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

  const status = computeJamStatus(submission.jam);

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
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Submissions Hidden</h1>
        <p className="mt-2 text-muted-foreground">
          Submissions are hidden during the jam period.
        </p>
      </div>
    );
  }

  const isLeader = submission.members.some(
    (m) => m.userId === session?.user?.id && m.isLeader
  );

  const canEdit =
    (isMember && status === "ONGOING") || canModerate;

  const showRateButton =
    session?.user?.id &&
    !isMember &&
    status === "RATING" &&
    submission.jam.ranked &&
    submission.status === "SUBMITTED" &&
    submission.rateable;

  // Filter private fields for non-organizers
  const visibleFields = submission.fieldValues.filter(
    (fv) => !fv.field.isPrivate || canModerate
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-2 text-sm text-muted-foreground">
        <Link href={`/jams/${submission.jam.slug}`} className="hover:underline">
          ← {submission.jam.name}
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-3xl font-bold">{submission.title}</h1>
            {submission.status === "DRAFT" && (
              <Badge variant="secondary">Draft</Badge>
            )}
            {!submission.competing && !submission.rateable && (
              <Badge variant="destructive">Disqualified</Badge>
            )}
            {!submission.competing && submission.rateable && (
              <Badge variant="secondary">Not competing</Badge>
            )}
            {!submission.visible && <Badge variant="outline">Hidden</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link
              href={`/submissions/${submission.id}/edit`}
              className={buttonVariants({ variant: "outline" })}
            >
              Edit
            </Link>
          )}
          {showRateButton && (
            <Link
              href={`/submissions/${submission.id}/rate`}
              className={buttonVariants()}
            >
              Rate
            </Link>
          )}
        </div>
      </div>

      {submission.coverUrl && (
        <div className="mb-6 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={submission.coverUrl}
            alt={submission.title}
            className="w-full object-cover"
          />
        </div>
      )}

      <Separator className="mb-6" />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          {submission.description && (
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {submission.description}
                </div>
              </CardContent>
            </Card>
          )}

          {submission.itchUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Play on itch.io</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <a
                  href={submission.itchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Open itch.io page →
                </a>
                {submission.supportedPlatforms.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {submission.supportedPlatforms.map((p) => (
                      <Badge key={p} variant="secondary">
                        {p.charAt(0) + p.slice(1).toLowerCase()}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {submission.screenshots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Screenshots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {submission.screenshots.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url}
                      alt={`Screenshot ${i + 1}`}
                      className="rounded-md object-cover"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {submission.videoUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Video</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={submission.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Watch Video →
                </a>
              </CardContent>
            </Card>
          )}

          {visibleFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {visibleFields.map((fv) => (
                  <div key={fv.id}>
                    <p className="text-sm font-medium">
                      {fv.field.name}
                      {fv.field.isPrivate && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Private
                        </Badge>
                      )}
                    </p>
                    {fv.field.type === "URL" ? (
                      <a
                        href={fv.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {fv.value}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {fv.value}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {submission.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between">
                    <Link
                      href={`/users/${m.user.username}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {m.user.displayName ?? m.user.username}
                    </Link>
                    {m.isLeader && (
                      <Badge variant="secondary" className="text-xs">
                        Leader
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

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

          {isLeader && status === "ONGOING" && (
            <TeamManager
              submissionId={submission.id}
              members={submission.members.map((m) => ({
                id: m.id,
                userId: m.user.id,
                username: m.user.username,
                displayName: m.user.displayName,
                isLeader: m.isLeader,
              }))}
              maxTeamSize={submission.jam.maxTeamSize}
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
        </div>
      </div>
    </div>
  );
}
