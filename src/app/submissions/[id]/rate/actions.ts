"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ratingSchema } from "@/lib/validations";
import { computeJamStatus } from "@/lib/jam-status";
import { checkRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";

async function checkRatingEligibility(
  jamId: string,
  userId: string,
  ratingEligibility: string
): Promise<boolean> {
  switch (ratingEligibility) {
    case "EVERYONE":
      return true;
    case "JUDGES_ONLY": {
      const judgeRole = await db.jamRole.findFirst({
        where: { jamId, userId, role: "JUDGE" },
      });
      return !!judgeRole;
    }
    case "SUBMITTERS_ONLY": {
      const membership = await db.submissionMember.findFirst({
        where: { userId, submission: { jamId }, isLeader: true },
      });
      return !!membership;
    }
    case "SUBMITTERS_AND_CONTRIBUTORS":
    default: {
      const membership = await db.submissionMember.findFirst({
        where: { userId, submission: { jamId } },
      });
      return !!membership;
    }
  }
}

export async function submitRatingAction(data: {
  submissionId: string;
  ratings: { criterionId: string; score: number }[];
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const { allowed } = checkRateLimit(`rate:${session.user.id}`);
  if (!allowed) return { error: "Too many requests. Please try again later." };

  const parsed = ratingSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const submission = await db.submission.findUnique({
    where: { id: parsed.data.submissionId },
    include: {
      jam: true,
      members: true,
    },
  });
  if (!submission) return { error: "Submission not found" };
  if (!submission.jam.ranked)
    return { error: "This jam is not ranked" };
  if (submission.status !== "SUBMITTED")
    return { error: "This submission is not finalized" };
  if (!submission.rateable)
    return { error: "This submission cannot be rated" };

  const status = computeJamStatus(submission.jam);
  if (status !== "RATING") {
    return { error: "Ratings are only accepted during the rating period" };
  }

  // Self-rating prevention
  const isMember = submission.members.some(
    (m) => m.userId === session.user!.id
  );
  if (isMember) return { error: "You cannot rate your own submission" };

  // Eligibility check
  const eligible = await checkRatingEligibility(
    submission.jamId,
    session.user.id,
    submission.jam.ratingEligibility
  );
  if (!eligible) return { error: "You are not eligible to rate in this jam" };

  // Validate criterion IDs belong to this jam
  const criteria = await db.criterion.findMany({
    where: { jamId: submission.jamId },
    select: { id: true },
  });
  const criteriaIds = new Set(criteria.map((c) => c.id));
  for (const r of parsed.data.ratings) {
    if (!criteriaIds.has(r.criterionId)) {
      return { error: "Invalid criterion" };
    }
  }

  // Upsert all ratings in a single transaction
  await db.$transaction(
    parsed.data.ratings.map((r) =>
      db.rating.upsert({
        where: {
          submissionId_criterionId_userId: {
            submissionId: parsed.data.submissionId,
            criterionId: r.criterionId,
            userId: session.user!.id,
          },
        },
        create: {
          submissionId: parsed.data.submissionId,
          criterionId: r.criterionId,
          userId: session.user!.id,
          score: r.score,
        },
        update: { score: r.score },
      })
    )
  );

  revalidatePath(`/submissions/${parsed.data.submissionId}`);
  return { success: true };
}

export async function getUserRatings(submissionId: string, userId: string) {
  return db.rating.findMany({
    where: { submissionId, userId },
    select: { criterionId: true, score: true },
  });
}
