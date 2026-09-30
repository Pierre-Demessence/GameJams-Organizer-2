import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { jamPhase, type JamPhase } from "@/domain/jam-phase";
import { LISTED_JAM, jamPhaseWhere, type ListedPhase } from "@/lib/jam-phase-where";
import { STATUS_PHASE, topTags, type JamListParams, type ListStatus } from "@/lib/jam-list-params";

export interface JamSummary {
  id: string;
  slug: string;
  name: string;
  shortDesc: string;
  coverUrl: string | null;
  tags: string[];
  ranked: boolean;
  phase: JamPhase;
  publishedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  ratingEnd: Date | null;
  joined: number;
  entries: number;
}
export interface JamList {
  jams: JamSummary[];
  counts: Record<ListStatus, number>;
  tags: string[];
  hasMore: boolean;
}

const LIVE_SUBMISSIONS = { status: "SUBMITTED", visible: true, deletedAt: null } as const;
const SELECT = {
  id: true, slug: true, name: true, shortDesc: true, coverUrl: true, tags: true, ranked: true,
  publishedAt: true, startDate: true, endDate: true, ratingEnd: true,
  _count: { select: { participants: true, submissions: { where: LIVE_SUBMISSIONS } } },
} satisfies Prisma.JamSelect;

// Natural order inside each phase: what ends or starts soonest first, newest results first.
const PHASE_ORDER: Record<ListedPhase, Prisma.JamOrderByWithRelationInput> = {
  ONGOING: { endDate: "asc" },
  UPCOMING: { startDate: "asc" },
  RATING: { ratingEnd: "asc" },
  FINISHED: { endDate: "desc" },
};
const RELEVANT_PHASES: ListedPhase[] = ["ONGOING", "UPCOMING", "RATING", "FINISHED"];

function baseWhere(p: JamListParams): Prisma.JamWhereInput {
  const and: Prisma.JamWhereInput[] = [LISTED_JAM];
  if (p.q) {
    and.push({
      OR: [
        { name: { contains: p.q, mode: "insensitive" } },
        { shortDesc: { contains: p.q, mode: "insensitive" } },
      ],
    });
  }
  if (p.tag) and.push({ tags: { has: p.tag } });
  if (p.format !== "any") and.push({ ranked: p.format === "ranked" });
  return { AND: and };
}

function orderFor(
  p: JamListParams,
  phase: ListedPhase | null
): Prisma.JamOrderByWithRelationInput | Prisma.JamOrderByWithRelationInput[] {
  if (p.sort === "newest") return { publishedAt: "desc" };
  if (p.sort === "joined") return [{ participants: { _count: "desc" } }, { id: "asc" }];
  return phase ? PHASE_ORDER[phase] : { publishedAt: "desc" };
}

type Row = Prisma.JamGetPayload<{ select: typeof SELECT }>;

function toSummary(row: Row, now: Date): JamSummary {
  return {
    id: row.id, slug: row.slug, name: row.name, shortDesc: row.shortDesc, coverUrl: row.coverUrl,
    tags: row.tags, ranked: row.ranked, publishedAt: row.publishedAt, startDate: row.startDate,
    endDate: row.endDate, ratingEnd: row.ratingEnd, phase: jamPhase(row, now),
    joined: row._count.participants, entries: row._count.submissions,
  };
}

export async function loadJamList(params: JamListParams, now = new Date()): Promise<JamList> {
  const base = baseWhere(params);
  const where = (phase: ListedPhase): Prisma.JamWhereInput => ({ AND: [base, jamPhaseWhere(phase, now)] });
  const take = params.show + 1;

  const [live, upcoming, rating, finished, tagRows] = await Promise.all([
    db.jam.count({ where: where("ONGOING") }),
    db.jam.count({ where: where("UPCOMING") }),
    db.jam.count({ where: where("RATING") }),
    db.jam.count({ where: where("FINISHED") }),
    db.jam.findMany({ where: LISTED_JAM, select: { tags: true }, orderBy: { publishedAt: "desc" }, take: 500 }),
  ]);
  const counts: Record<ListStatus, number> = {
    all: live + upcoming + rating + finished, live, upcoming, rating, finished,
  };

  let rows: Row[];
  if (params.status !== "all") {
    const phase = STATUS_PHASE[params.status];
    rows = await db.jam.findMany({ where: where(phase), select: SELECT, orderBy: orderFor(params, phase), take });
  } else if (params.sort === "relevant") {
    const groups = await Promise.all(
      RELEVANT_PHASES.map((phase) =>
        db.jam.findMany({ where: where(phase), select: SELECT, orderBy: PHASE_ORDER[phase], take })
      )
    );
    rows = groups.flat();
  } else {
    rows = await db.jam.findMany({ where: base, select: SELECT, orderBy: orderFor(params, null), take });
  }

  return {
    jams: rows.slice(0, params.show).map((r) => toSummary(r, now)),
    counts,
    tags: topTags(tagRows.map((r) => r.tags)),
    hasMore: rows.length > params.show,
  };
}
