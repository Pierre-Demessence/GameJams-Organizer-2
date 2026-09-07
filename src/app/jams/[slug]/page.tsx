import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { computeJamStatus } from "@/lib/jam-status";
import { hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JoinJamButton, PublishJamButton } from "./jam-actions-client";
import { SubmissionList } from "./submission-list";
import { Markdown } from "@/components/markdown";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const jam = await db.jam.findUnique({
    where: { slug },
    select: { name: true, shortDesc: true, startDate: true, endDate: true, ratingEnd: true, ranked: true },
  });
  if (!jam) return { title: "Jam Not Found" };
  if (computeJamStatus(jam) === "DRAFT") return { title: "Game Jam" };
  return { title: jam.name, description: jam.shortDesc };
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500",
  UPCOMING: "bg-blue-500",
  ONGOING: "bg-green-500",
  RATING: "bg-yellow-500",
  FINISHED: "bg-purple-500",
};

function formatDate(date: Date | null) {
  if (!date) return "TBD";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function JamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  const jam = await db.jam.findUnique({
    where: { slug },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      roles: { include: { user: { select: { username: true, displayName: true } } } },
      _count: { select: { participants: true, submissions: true } },
      criteria: { select: { id: true, name: true, description: true, weight: true } },
      submissions: {
        where: { status: "SUBMITTED", visible: true },
        include: {
          members: {
            include: { user: { select: { username: true, displayName: true } } },
            orderBy: { isLeader: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!jam) notFound();

  const status = computeJamStatus(jam);

  const userRoles = session?.user?.id
    ? jam.roles
        .filter((r) => r.userId === session.user!.id)
        .map((r) => r.role)
    : [];
  const canEditJam = hasPermission(userRoles, "edit_jam");
  const canManageRoles = hasPermission(userRoles, "manage_roles");

  // Draft jams only visible to organizers (any role)
  if (status === "DRAFT") {
    const isOrganizer = userRoles.length > 0;
    if (!isOrganizer) notFound();
  }

  const hasJoined = session?.user?.id
    ? await db.jamParticipant.findUnique({
        where: {
          jamId_userId: { jamId: jam.id, userId: session.user.id },
        },
      })
    : null;

  const userSubmission = session?.user?.id
    ? await db.submissionMember.findFirst({
        where: {
          userId: session.user.id,
          submission: { jamId: jam.id },
        },
        select: { submissionId: true },
      })
    : null;

  const showJoinButton =
    session?.user &&
    !hasJoined &&
    (status === "UPCOMING" || status === "ONGOING");

  const showTheme =
    jam.theme &&
    (!jam.revealThemeOnStart || status !== "UPCOMING");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-3xl font-bold">{jam.name}</h1>
            <Badge className={statusColors[status]}>{status}</Badge>
            {jam.visibility === "UNLISTED" && (
              <Badge variant="outline">Unlisted</Badge>
            )}
          </div>
          <p className="text-muted-foreground">{jam.shortDesc}</p>
        </div>
        <div className="flex gap-2">
          {canEditJam && status === "DRAFT" && (
            <PublishJamButton jamId={jam.id} />
          )}
          {canEditJam && (
            <Link
              href={`/jams/${jam.slug}/edit`}
              className={buttonVariants({ variant: "outline" })}
            >
              Edit
            </Link>
          )}
          {canManageRoles && (
            <Link
              href={`/jams/${jam.slug}/manage`}
              className={buttonVariants({ variant: "outline" })}
            >
              Manage
            </Link>
          )}
          {jam.ranked && (status === "RATING" || status === "FINISHED") && (
            <Link
              href={`/jams/${jam.slug}/results`}
              className={buttonVariants({ variant: "outline" })}
            >
              Results
            </Link>
          )}
          {showJoinButton && <JoinJamButton jamId={jam.id} />}
          {hasJoined && (
            <Badge variant="secondary">Joined</Badge>
          )}
        </div>
      </div>

      {/* Tags */}
      {jam.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {jam.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <Separator className="mb-6" />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 md:col-span-2">
          {/* Theme */}
          {showTheme && (
            <Card>
              <CardHeader>
                <CardTitle>Theme</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">{jam.theme}</p>
              </CardContent>
            </Card>
          )}

          {jam.revealThemeOnStart && status === "UPCOMING" && jam.theme && (
            <Card>
              <CardHeader>
                <CardTitle>Theme</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground italic">
                  Theme will be revealed when the jam starts.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <Markdown>{jam.fullDesc}</Markdown>
            </CardContent>
          </Card>

          {/* Submission Details */}
          {jam.submissionDetails && (
            <Card>
              <CardHeader>
                <CardTitle>Submission Guidelines</CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown>{jam.submissionDetails}</Markdown>
              </CardContent>
            </Card>
          )}

          {/* Criteria (Ranked jams) */}
          {jam.ranked && jam.criteria.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rating Criteria</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {jam.criteria.map((c) => (
                    <li key={c.id} className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{c.name}</span>
                        {c.description && (
                          <p className="text-sm text-muted-foreground">
                            {c.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">Weight: {c.weight}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Submissions */}
          <SubmissionList
            submissions={jam.submissions}
            jamSlug={jam.slug}
            status={status}
            hasJoined={!!hasJoined}
            userSubmissionId={userSubmission?.submissionId ?? null}
            hideSubmissionsBeforeEnd={jam.hideSubmissionsBeforeEnd}
            isAdmin={canEditJam}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Starts</p>
                <p className="text-muted-foreground">
                  {formatDate(jam.startDate)}
                </p>
              </div>
              <div>
                <p className="font-medium">Ends</p>
                <p className="text-muted-foreground">
                  {formatDate(jam.endDate)}
                </p>
              </div>
              {jam.ranked && (
                <div>
                  <p className="font-medium">Rating Ends</p>
                  <p className="text-muted-foreground">
                    {formatDate(jam.ratingEnd)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Participants</span>
                <span className="font-medium">{jam._count.participants}</span>
              </div>
              <div className="flex justify-between">
                <span>Submissions</span>
                <span className="font-medium">{jam._count.submissions}</span>
              </div>
              {jam.ranked && (
                <div className="flex justify-between">
                  <span>Type</span>
                  <span className="font-medium">Ranked</span>
                </div>
              )}
              {jam.maxTeamSize && (
                <div className="flex justify-between">
                  <span>Max Team Size</span>
                  <span className="font-medium">{jam.maxTeamSize}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organizers</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {jam.roles.map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    <Link
                      href={`/users/${r.user.username}`}
                      className="text-primary hover:underline"
                    >
                      {r.user.displayName ?? r.user.username}
                    </Link>
                    <Badge variant="outline" className="text-xs">
                      {r.role}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {jam.hashtag && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">{jam.hashtag}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
