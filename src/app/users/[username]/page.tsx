import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { computeJamStatus } from "@/lib/jam-status";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return { title: `${username} — GameJam Organizer` };
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params;

  const user = await db.user.findUnique({
    where: { username },
    include: {
      jamParticipants: {
        where: { jam: { deletedAt: null } },
        include: {
          jam: { select: { name: true, slug: true, startDate: true, endDate: true, ratingEnd: true, ranked: true } },
        },
        take: 20,
      },
      submissions: {
        where: { submission: { deletedAt: null, jam: { deletedAt: null } } },
        include: {
          submission: {
            select: { id: true, title: true, jam: { select: { name: true, slug: true } } },
          },
        },
        take: 20,
      },
    },
  });

  if (!user) notFound();

  const initials = (user.displayName ?? user.username)
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="container mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="flex items-center gap-6">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.username} />
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold">
            {user.displayName ?? user.username}
          </h1>
          {user.displayName && (
            <p className="text-muted-foreground">@{user.username}</p>
          )}
          {user.bio && <p className="mt-2 max-w-lg">{user.bio}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            Joined {user.createdAt.toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Jams Participated</CardTitle>
          </CardHeader>
          <CardContent>
            {user.jamParticipants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jams yet.</p>
            ) : (
              <ul className="space-y-2">
                {user.jamParticipants.map((p) => (
                  <li key={p.jamId} className="flex items-center justify-between text-sm">
                    <Link
                      href={`/jams/${p.jam.slug}`}
                      className="hover:underline"
                    >
                      {p.jam.name}
                    </Link>
                    <Badge variant="secondary">{computeJamStatus(p.jam)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {user.submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions yet.</p>
            ) : (
              <ul className="space-y-2">
                {user.submissions.map((sm) => (
                  <li key={sm.submissionId} className="text-sm">
                    <Link
                      href={`/submissions/${sm.submissionId}`}
                      className="hover:underline"
                    >
                      {sm.submission.title}
                    </Link>
                    <span className="ml-2 text-muted-foreground">
                      in{" "}
                      <Link
                        href={`/jams/${sm.submission.jam.slug}`}
                        className="hover:underline"
                      >
                        {sm.submission.jam.name}
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
