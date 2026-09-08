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
    orderBy: [{ rank: "asc" }, { finalScore: "desc" }],
  });

  const competing = results.filter((r) => r.competing);
  const notCompeting = results.filter((r) => !r.competing);

  const criteria = jam.criteria;

  type CriterionScore = {
    raw: number;
    weighted: number;
    count: number;
    rank: number | null;
  };

  function ResultCard({ result }: { result: (typeof results)[number] }) {
    const leader = result.submission.members.find((m) => m.isLeader);
    const criteriaScores = result.criteriaScores as Record<string, CriterionScore>;

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-muted-foreground">
                {result.rank ? `#${result.rank}` : "—"}
              </span>
              <div>
                <Link
                  href={`/submissions/${result.submissionId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {result.submission.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  by{" "}
                  {leader
                    ? (leader.user.displayName ?? leader.user.username)
                    : "Unknown"}
                  {result.submission.members.length > 1 &&
                    ` +${result.submission.members.length - 1}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{result.finalScore.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                {result.totalRatings} ratings
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {criteria.map((c) => {
              const cs = criteriaScores[c.id];
              return (
                <Badge key={c.id} variant="outline">
                  {c.name}: {cs ? cs.weighted.toFixed(2) : "—"}
                  {cs?.rank ? ` (#${cs.rank})` : ""}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

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
        <div className="space-y-8">
          <div className="space-y-3">
            {competing.map((r) => (
              <ResultCard key={r.id} result={r} />
            ))}
          </div>

          {notCompeting.length > 0 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold">Not competing</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Rated but excluded from the ranking.
              </p>
              <div className="space-y-3">
                {notCompeting.map((r) => (
                  <ResultCard key={r.id} result={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
