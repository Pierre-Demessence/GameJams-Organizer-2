import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { computeJamStatus } from "@/lib/jam-status";
import { RatingForm } from "./rating-form";
import { getUserRatings } from "./actions";

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
          startDate: true,
          endDate: true,
          ratingEnd: true,
          ranked: true,
          ratingEligibility: true,
        },
      },
      members: true,
    },
  });
  if (!submission) notFound();

  if (!submission.jam.ranked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-muted-foreground">This jam is not ranked.</p>
      </div>
    );
  }

  const status = computeJamStatus(submission.jam);
  if (status !== "RATING") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Rating Not Open</h1>
        <p className="mt-2 text-muted-foreground">
          Ratings are only accepted during the rating period.
        </p>
      </div>
    );
  }

  // Self-rating prevention
  const isMember = submission.members.some(
    (m) => m.userId === session.user!.id
  );
  if (isMember) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Cannot Rate</h1>
        <p className="mt-2 text-muted-foreground">
          You cannot rate your own submission.
        </p>
      </div>
    );
  }

  if (submission.disqualified) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-muted-foreground">
          This submission has been disqualified.
        </p>
      </div>
    );
  }

  const criteria = await db.criterion.findMany({
    where: { jamId: submission.jamId },
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
