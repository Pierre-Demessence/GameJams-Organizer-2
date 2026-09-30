import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { loadJamResults } from "@/lib/scoring";
import { jamPhase } from "@/domain/jam-phase";
import { canRevealResults, resultsAccess } from "@/domain/results";
import type { SubmissionResult } from "@/domain/scoring";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { RevealResultsButton } from "./reveal-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const jam = await db.jam.findUnique({
    where: { slug },
    select: {
      name: true,
      publishedAt: true,
      startDate: true,
      endDate: true,
      ratingEnd: true,
      ranked: true,
    },
  });
  if (!jam) return { title: "Results Not Found" };
  if (jamPhase(jam) === "DRAFT") return { title: "Results" };
  return { title: `Results — ${jam.name}` };
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
    </div>
  );
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
      criteria: { where: { source: "RATED" }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!jam || !jam.ranked) notFound();

  const phase = jamPhase(jam);
  const userRoles = session?.user?.id
    ? jam.roles.filter((r) => r.userId === session.user!.id).map((r) => r.role)
    : [];

  if (phase === "DRAFT" && userRoles.length === 0) notFound();

  const access = resultsAccess({
    ...jam,
    phase,
    canPreview: hasPermission(userRoles, "preview_results"),
  });

  if (access === "none") {
    return phase === "FINISHED" ? (
      <Notice
        title="Results Hidden"
        message="The organizers will reveal the results soon."
      />
    ) : (
      <Notice
        title="Results Not Available Yet"
        message="Results are published once the rating period ends."
      />
    );
  }

  const results = await loadJamResults(jam.id);
  const submissionIds = [...results.competing, ...results.notCompeting].map(
    (r) => r.submissionId
  );
  const submissions = await db.submission.findMany({
    where: { id: { in: submissionIds } },
    select: {
      id: true,
      title: true,
      members: {
        include: { user: { select: { username: true, displayName: true } } },
        orderBy: { isLeader: "desc" },
      },
    },
  });
  const submissionById = new Map(submissions.map((s) => [s.id, s]));

  const canReveal =
    hasPermission(userRoles, "edit_jam") &&
    canRevealResults({ ...jam, phase }).allowed;

  const criteria = jam.criteria;

  function ResultCard({ result }: { result: SubmissionResult }) {
    const submission = submissionById.get(result.submissionId);
    if (!submission) return null;
    const leader = submission.members.find((m) => m.isLeader);

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
                  {submission.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  by{" "}
                  {leader
                    ? (leader.user.displayName ?? leader.user.username)
                    : "Unknown"}
                  {submission.members.length > 1 &&
                    ` +${submission.members.length - 1}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              {result.finalScore !== null && (
                <p className="text-lg font-bold">{result.finalScore.toFixed(2)}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {result.totalRatings} ratings
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {criteria.map((c) => {
              const cs = result.criteriaScores[c.id];
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

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Results</h1>
          {access === "preview" && (
            <Badge variant="outline">Organizer preview — not public yet</Badge>
          )}
        </div>
        {canReveal && <RevealResultsButton jamId={jam.id} />}
      </div>

      {results.competing.length === 0 && results.notCompeting.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No submissions have been rated yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {!results.hasOverall && (
            <p className="text-sm text-muted-foreground">
              This jam has no overall ranking; see each criterion&apos;s placement below.
            </p>
          )}
          <div className="space-y-3">
            {results.competing.map((r) => (
              <ResultCard key={r.submissionId} result={r} />
            ))}
          </div>

          {results.notCompeting.length > 0 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold">Not competing</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Rated but excluded from the ranking.
              </p>
              <div className="space-y-3">
                {results.notCompeting.map((r) => (
                  <ResultCard key={r.submissionId} result={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
