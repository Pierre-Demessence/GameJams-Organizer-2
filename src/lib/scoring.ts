import { db } from "@/lib/db";
import { rankSubmissions, type JamResults } from "@/domain/scoring";

// Results are computed on read from the live ratings, so they are never stale
// and need no organizer action once the jam finishes.
export async function loadJamResults(jamId: string): Promise<JamResults> {
  const [criteria, submissions, ratings] = await Promise.all([
    db.criterion.findMany({
      where: { jamId },
      select: { id: true, weight: true, source: true, isPrimary: true },
    }),
    db.submission.findMany({
      where: { jamId, status: "SUBMITTED" },
      select: { id: true, competing: true },
      orderBy: { createdAt: "asc" },
    }),
    db.rating.findMany({
      where: { submission: { jamId, status: "SUBMITTED", deletedAt: null } },
      select: { submissionId: true, criterionId: true, score: true },
    }),
  ]);
  return rankSubmissions({ criteria, submissions, ratings });
}
