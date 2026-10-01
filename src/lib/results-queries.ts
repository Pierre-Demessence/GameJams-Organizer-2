import { db } from "@/lib/db";
import { loadJamResults } from "@/lib/scoring";
import type { JamResults } from "@/domain/scoring";

export interface ResultEntry {
  id: string;
  title: string;
  coverUrl: string | null;
  rateable: boolean;
  moderationReason: string | null;
  team: string[];
}
export interface JamResultsPage {
  results: JamResults;
  entries: Map<string, ResultEntry>;
  // Distinct (rater, submission) pairs, i.e. "games rated", not per-criterion scores.
  ratings: number;
}

export async function loadResultsPage(jamId: string): Promise<JamResultsPage> {
  const ranked = await loadJamResults(jamId);
  const ids = [...ranked.competing, ...ranked.notCompeting].map((r) => r.submissionId);
  const [rows, raterPairs] = await Promise.all([
    db.submission.findMany({
      where: { id: { in: ids }, visible: true },
      select: {
        id: true, title: true, coverUrl: true, rateable: true, moderationReason: true,
        members: {
          select: { user: { select: { username: true, displayName: true } } },
          orderBy: { isLeader: "desc" },
        },
      },
    }),
    db.rating.groupBy({
      by: ["submissionId", "userId"],
      where: { submission: { jamId, status: "SUBMITTED", deletedAt: null } },
    }),
  ]);
  const entries = new Map(
    rows.map((s) => [
      s.id,
      {
        id: s.id, title: s.title, coverUrl: s.coverUrl, rateable: s.rateable,
        moderationReason: s.moderationReason,
        team: s.members.map((m) => m.user.displayName ?? m.user.username),
      },
    ])
  );
  // Rank over everything, then drop hidden entries, as the homepage podium does: hiding a
  // submission removes it from the jam's pages without re-ranking the others.
  const shown = (r: { submissionId: string }) => entries.has(r.submissionId);
  const results: JamResults = {
    ...ranked,
    competing: ranked.competing.filter(shown),
    notCompeting: ranked.notCompeting.filter(shown),
  };
  return { results, entries, ratings: raterPairs.length };
}
