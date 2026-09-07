import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { computeJamStatus } from "@/lib/jam-status";
import { hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { ComputeResultsButton } from "./compute-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const jam = await db.jam.findUnique({
    where: { slug },
    select: { name: true, startDate: true, endDate: true, ratingEnd: true, ranked: true },
  });
  if (!jam) return { title: "Results Not Found" };
  if (computeJamStatus(jam) === "DRAFT") return { title: "Results" };
  return { title: `Results — ${jam.name}` };
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  const jam = await db.jam.findUnique({
    where: { slug },
    include: {
      roles: true,
      criteria: { where: { weight: { gt: 0 } }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!jam) notFound();
  if (!jam.ranked) notFound();

  const status = computeJamStatus(jam);

  const userRoles = session?.user?.id
    ? jam.roles
        .filter((r) => r.userId === session.user!.id)
        .map((r) => r.role)
    : [];
  const isAdmin = hasPermission(userRoles, "edit_jam");

  if (status === "DRAFT") {
    const isOrganizer = userRoles.length > 0;
    if (!isOrganizer) notFound();
  }

  // Only show results when rating is finished (or admin preview)
  if (jam.hideResults && status !== "FINISHED" && !isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold">Results Hidden</h1>
        <p className="mt-2 text-muted-foreground">
          Results will be revealed after the jam finishes.
        </p>
      </div>
    );
  }

  const results = await db.jamResult.findMany({
    where: { jamId: jam.id },
    include: {
      submission: {
        select: {
          id: true,
          title: true,
          members: {
            include: {
              user: { select: { username: true, displayName: true } },
            },
            orderBy: { isLeader: "desc" },
          },
        },
      },
    },
    orderBy: { rank: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-2 text-sm text-muted-foreground">
        <Link href={`/jams/${slug}`} className="hover:underline">
          ← {jam.name}
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Results</h1>
        {isAdmin && <ComputeResultsButton jamId={jam.id} />}
      </div>

      {results.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No results computed yet.
            {isAdmin && " Click &quot;Recompute Results&quot; to generate rankings."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {results.map((r) => {
            const leader = r.submission.members.find((m) => m.isLeader);
            const criteriaScores = r.criteriaScores as Record<
              string,
              { raw: number; weighted: number; count: number }
            >;

            return (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-muted-foreground">
                        #{r.rank}
                      </span>
                      <div>
                        <Link
                          href={`/submissions/${r.submissionId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {r.submission.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          by{" "}
                          {leader
                            ? (leader.user.displayName ?? leader.user.username)
                            : "Unknown"}
                          {r.submission.members.length > 1 &&
                            ` +${r.submission.members.length - 1}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {r.finalScore.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.totalRatings} ratings
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {jam.criteria.map((c) => {
                      const cs = criteriaScores[c.id];
                      return (
                        <Badge key={c.id} variant="outline">
                          {c.name}: {cs ? cs.weighted.toFixed(2) : "—"}
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
