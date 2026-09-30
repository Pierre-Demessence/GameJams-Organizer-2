"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ratingSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { jamPhase } from "@/domain/jam-phase";
import { canRate } from "@/domain/rating";
import { loadRater } from "@/lib/rating-queries";
import { revalidatePath } from "next/cache";

export async function submitRatingAction(data: {
  submissionId: string;
  ratings: { criterionId: string; score: number }[];
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  const userId = session.user.id;

  const { allowed } = checkRateLimit(`rate:${userId}`);
  if (!allowed) return { error: "Too many requests. Please try again later." };

  const parsed = ratingSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const submission = await db.submission.findUnique({
    where: { id: parsed.data.submissionId },
    include: { jam: true, members: true },
  });
  if (!submission || submission.jam.deletedAt) return { error: "Submission not found" };

  const decision = canRate({
    phase: jamPhase(submission.jam),
    ranked: submission.jam.ranked,
    eligibility: submission.jam.ratingEligibility,
    rater: await loadRater(submission.jamId, userId),
    isOwnSubmission: submission.members.some((m) => m.userId === userId),
    submission,
  });
  if (!decision.allowed) return { error: decision.reason };

  const criteria = await db.criterion.findMany({
    where: { jamId: submission.jamId, source: "RATED" },
    select: { id: true },
  });
  const criteriaIds = new Set(criteria.map((c) => c.id));
  for (const r of parsed.data.ratings) {
    if (!criteriaIds.has(r.criterionId)) {
      return { error: "Invalid criterion" };
    }
  }

  await db.$transaction(
    parsed.data.ratings.map((r) =>
      db.rating.upsert({
        where: {
          submissionId_criterionId_userId: {
            submissionId: parsed.data.submissionId,
            criterionId: r.criterionId,
            userId,
          },
        },
        create: {
          submissionId: parsed.data.submissionId,
          criterionId: r.criterionId,
          userId,
          score: r.score,
        },
        update: { score: r.score },
      })
    )
  );

  revalidatePath(`/submissions/${parsed.data.submissionId}`);
  return { success: true };
}
