import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getUserRatings, loadRater } from "@/lib/rating-queries";
import { jamPhase } from "@/domain/jam-phase";
import { canRate } from "@/domain/rating";
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
          ratingEligibility: true,
          deletedAt: true,
        },
      },
      members: true,
    },
  });
  if (!submission || submission.jam.deletedAt) notFound();

  const phase = jamPhase(submission.jam);
  if (phase === "DRAFT") notFound();

  const decision = canRate({
    phase,
    ranked: submission.jam.ranked,
    eligibility: submission.jam.ratingEligibility,
    rater: await loadRater(submission.jamId, session.user.id),
    isOwnSubmission: submission.members.some((m) => m.userId === session.user!.id),
    submission,
  });
  if (!decision.allowed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Cannot Rate</h1>
        <p className="mt-2 text-muted-foreground">{decision.reason}</p>
      </div>
    );
  }

  const criteria = await db.criterion.findMany({
    where: { jamId: submission.jamId, source: "RATED" },
    orderBy: { sortOrder: "asc" },
  });

  const existingRatings = await getUserRatings(id, session.user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href={`/submissions/${id}`} className="hover:underline">
          ← {submission.title}
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold">Rate: {submission.title}</h1>
      <RatingForm
        submissionId={id}
        criteria={criteria}
        existingRatings={existingRatings}
      />
    </div>
  );
}
