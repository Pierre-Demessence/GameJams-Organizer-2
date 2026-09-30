import { db } from "@/lib/db";
import { getJamRoles, hasPermission } from "@/lib/permissions";
import type { Rater } from "@/domain/rating";

// Plain server module, not a "use server" file: these must never be callable
// from the client, since ratings are anonymous (spec §6.3).

// Only finalized, non-deleted submissions make their members eligible raters.
export async function loadRater(jamId: string, userId: string): Promise<Rater> {
  const [roles, membership] = await Promise.all([
    getJamRoles(jamId, userId),
    db.submissionMember.findFirst({
      where: {
        userId,
        submission: { jamId, status: "SUBMITTED", deletedAt: null },
      },
      select: { isLeader: true },
    }),
  ]);
  return { isJudge: hasPermission(roles, "rate_as_judge"), membership };
}

export function getUserRatings(submissionId: string, userId: string) {
  return db.rating.findMany({
    where: { submissionId, userId },
    select: { criterionId: true, score: true },
  });
}
