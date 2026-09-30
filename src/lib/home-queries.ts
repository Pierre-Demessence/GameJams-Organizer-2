import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { jamPhase, type JamPhase } from "@/domain/jam-phase";
import { podium, resultsArePublic } from "@/domain/results";
import { loadJamResults } from "@/lib/scoring";
import { nextDeadline } from "@/lib/jam-status-display";

export interface HomeJam {
  id: string;
  slug: string;
  name: string;
  shortDesc: string;
  phase: JamPhase;
  ranked: boolean;
  publishedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  ratingEnd: Date | null;
  joined: number;
  entries: number;
}
export interface PodiumEntry {
  place: number;
  submissionId: string;
  title: string;
  score: number | null;
}
export interface FinishedJam extends HomeJam {
  // null while results are not public (or for showcase jams); [] when nobody was rated.
  podium: PodiumEntry[] | null;
  // Distinct (rater, submission) pairs, i.e. "games rated", not per-criterion scores.
  ratings: number;
}
export interface HomeData {
  live: HomeJam[];
  upcoming: HomeJam[];
  finished: FinishedJam[];
}

const LIVE_SUBMISSIONS = { status: "SUBMITTED", visible: true, deletedAt: null } as const;
const LISTED: Prisma.JamWhereInput = {
  deletedAt: null,
  visibility: "PUBLIC",
  publishedAt: { not: null },
};
const SELECT = {
  id: true, slug: true, name: true, shortDesc: true, ranked: true, publishedAt: true,
  startDate: true, endDate: true, ratingEnd: true, hideResults: true, resultsRevealedAt: true,
  _count: { select: { participants: true, submissions: { where: LIVE_SUBMISSIONS } } },
} satisfies Prisma.JamSelect;

function findRows(
  where: Prisma.JamWhereInput,
  orderBy: Prisma.JamOrderByWithRelationInput,
  take: number
) {
  return db.jam.findMany({ where: { AND: [LISTED, where] }, select: SELECT, orderBy, take });
}
type Row = Awaited<ReturnType<typeof findRows>>[number];

function toHomeJam(row: Row, now: Date): HomeJam {
  return {
    id: row.id, slug: row.slug, name: row.name, shortDesc: row.shortDesc, ranked: row.ranked,
    publishedAt: row.publishedAt, startDate: row.startDate, endDate: row.endDate,
    ratingEnd: row.ratingEnd, phase: jamPhase(row, now),
    joined: row._count.participants, entries: row._count.submissions,
  };
}

async function loadPodium(
  row: Row,
  phase: JamPhase
): Promise<{ podium: PodiumEntry[] | null; ratings: number }> {
  if (!resultsArePublic({ ...row, phase })) return { podium: null, ratings: 0 };
  const [results, raterPairs] = await Promise.all([
    loadJamResults(row.id),
    db.rating.groupBy({
      by: ["submissionId", "userId"],
      // Relation filters bypass the soft-delete extension, so exclude deleted entries here.
      where: { submission: { jamId: row.id, status: "SUBMITTED", deletedAt: null } },
    }),
  ]);
  // Rank over everything, then drop moderated (hidden) entries from the homepage.
  const ranked = podium(results, results.competing.length);
  const visible = await db.submission.findMany({
    where: { id: { in: ranked.map((r) => r.submissionId) }, visible: true },
    select: { id: true, title: true },
  });
  const titleOf = new Map(visible.map((s) => [s.id, s.title]));
  return {
    ratings: raterPairs.length,
    podium: ranked
      .filter((r) => titleOf.has(r.submissionId))
      .slice(0, 3)
      // Renumber: a hidden entry may hold rank 1, and the homepage must still start at 1st.
      .map((r, i) => ({
        place: i + 1,
        submissionId: r.submissionId,
        title: titleOf.get(r.submissionId) as string,
        score: r.finalScore,
      })),
  };
}

export async function loadHomeData(now = new Date()): Promise<HomeData> {
  const [ongoing, rating, upcoming, finished] = await Promise.all([
    findRows({ startDate: { lte: now }, endDate: { gt: now } }, { endDate: "asc" }, 6),
    findRows(
      { ranked: true, endDate: { lte: now }, ratingEnd: { gt: now } },
      { ratingEnd: "asc" },
      6
    ),
    findRows({ startDate: { gt: now } }, { startDate: "asc" }, 6),
    findRows(
      { OR: [{ ranked: true, ratingEnd: { lte: now } }, { ranked: false, endDate: { lte: now } }] },
      { endDate: "desc" },
      3
    ),
  ]);

  // Each group is already sorted by its own deadline; merge them on the next deadline.
  const deadline = (j: HomeJam) => nextDeadline(j, j.phase)?.at.getTime() ?? Infinity;
  const live = [...ongoing, ...rating]
    .map((r) => toHomeJam(r, now))
    .sort((a, b) => deadline(a) - deadline(b))
    .slice(0, 6);

  return {
    live,
    upcoming: upcoming.map((r) => toHomeJam(r, now)),
    finished: await Promise.all(
      finished.map(async (r) => {
        const jam = toHomeJam(r, now);
        return { ...jam, ...(await loadPodium(r, jam.phase)) };
      })
    ),
  };
}
