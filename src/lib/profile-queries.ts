import { db } from "@/lib/db";
import { jamPhase, type JamPhase } from "@/domain/jam-phase";
import { resultsArePublic } from "@/domain/results";
import type { JamResults } from "@/domain/scoring";
import { LISTED_JAM } from "@/lib/jam-phase-where";
import { dayRange } from "@/lib/jam-page";
import { loadJamResults } from "@/lib/scoring";
import { compareJams, jamRoleSummary, placement, teamLine, type Placement } from "@/lib/profile";

const JAM_FIELDS = {
  id: true, slug: true, name: true, publishedAt: true, startDate: true, endDate: true,
  ratingEnd: true, ranked: true, hideResults: true, resultsRevealedAt: true,
} as const;

// Profiles are public, so they list only public, published jams: unlisted and draft jams
// must not leak through a member's page. Lists show the most recent rows; stats are counts.
const LIMIT = 50;

export interface ProfileGame {
  id: string;
  title: string;
  coverUrl: string | null;
  jam: { slug: string; name: string };
  team: string;
  placement: Placement | null;
}
export interface ProfileJam {
  slug: string;
  name: string;
  phase: JamPhase;
  role: string;
  dates: string;
}
export interface Profile {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    createdAt: Date;
  };
  stats: { jamsJoined: number; games: number; organized: number };
  games: ProfileGame[];
  jams: ProfileJam[];
}

export async function loadProfile(username: string): Promise<Profile | null> {
  const user = await db.user.findUnique({
    where: { username },
    select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true, createdAt: true },
  });
  if (!user) return null;

  const participationWhere = { userId: user.id, jam: LISTED_JAM };
  const membershipWhere = {
    userId: user.id,
    // Relation filters bypass the soft-delete extension; drafts and hidden entries are
    // visible only to their team and organizers.
    submission: { status: "SUBMITTED" as const, visible: true, deletedAt: null, jam: LISTED_JAM },
  };
  const [participations, roles, memberships, jamsJoined, gameCount, organized] = await Promise.all([
    db.jamParticipant.findMany({
      where: participationWhere,
      select: { jam: { select: JAM_FIELDS } },
      orderBy: { jam: { startDate: "desc" } },
      take: LIMIT,
    }),
    db.jamRole.findMany({
      where: { userId: user.id, jam: LISTED_JAM },
      select: { role: true, jam: { select: JAM_FIELDS } },
      orderBy: { jam: { startDate: "desc" } },
      take: LIMIT,
    }),
    db.submissionMember.findMany({
      where: membershipWhere,
      select: {
        submission: {
          select: {
            id: true, title: true, coverUrl: true, competing: true,
            jam: { select: JAM_FIELDS },
            members: {
              select: { userId: true, user: { select: { username: true, displayName: true } } },
              orderBy: { isLeader: "desc" },
            },
          },
        },
      },
      orderBy: { submission: { jam: { startDate: "desc" } } },
      take: LIMIT,
    }),
    db.jamParticipant.count({ where: participationWhere }),
    db.submissionMember.count({ where: membershipWhere }),
    db.jam.count({
      where: { ...LISTED_JAM, roles: { some: { userId: user.id, role: { in: ["ADMIN", "HOST"] } } } },
    }),
  ]);

  type Row = (typeof roles)[number];
  const jams = new Map<string, { jam: Row["jam"]; participant: boolean; roles: Row["role"][] }>();
  for (const p of participations) jams.set(p.jam.id, { jam: p.jam, participant: true, roles: [] });
  for (const r of roles) {
    const entry = jams.get(r.jam.id) ?? { jam: r.jam, participant: false, roles: [] };
    entry.roles.push(r.role);
    jams.set(r.jam.id, entry);
  }

  const jamList: ProfileJam[] = [...jams.values()]
    .map((j) => ({ ...j, phase: jamPhase(j.jam), startDate: j.jam.startDate }))
    .sort(compareJams)
    .map(({ jam, phase, participant, roles: rs }) => ({
      slug: jam.slug,
      name: jam.name,
      phase,
      role: jamRoleSummary(participant, rs),
      dates: dayRange(jam.startDate, jam.endDate),
    }));

  const subs = memberships.map((m) => ({ ...m.submission, phase: jamPhase(m.submission.jam) }));
  const publicJamIds = [
    ...new Set(subs.filter((s) => resultsArePublic({ ...s.jam, phase: s.phase })).map((s) => s.jam.id)),
  ];
  const [resultsByJam, criteria] = await Promise.all([
    Promise.all(publicJamIds.map(async (id) => [id, await loadJamResults(id)] as const)).then(
      (pairs) => new Map<string, JamResults>(pairs)
    ),
    db.criterion.findMany({
      where: { jamId: { in: publicJamIds }, source: "RATED" },
      select: { id: true, name: true },
    }),
  ]);
  const criterionName = new Map(criteria.map((c) => [c.id, c.name]));

  const games: ProfileGame[] = subs
    .sort((a, b) => (b.jam.startDate?.getTime() ?? 0) - (a.jam.startDate?.getTime() ?? 0))
    .map((s) => {
      const results = resultsByJam.get(s.jam.id);
      const result = results?.competing.find((r) => r.submissionId === s.id);
      let bestCriterion: { name: string; rank: number } | null = null;
      for (const [id, cs] of Object.entries(result?.criteriaScores ?? {})) {
        if (cs.rank !== null && (!bestCriterion || cs.rank < bestCriterion.rank)) {
          bestCriterion = { name: criterionName.get(id) ?? "Criterion", rank: cs.rank };
        }
      }
      return {
        id: s.id,
        title: s.title,
        coverUrl: s.coverUrl,
        jam: { slug: s.jam.slug, name: s.jam.name },
        team: teamLine(
          s.members.filter((m) => m.userId !== user.id).map((m) => m.user.displayName ?? m.user.username)
        ),
        placement: placement({
          phase: s.phase,
          ranked: s.jam.ranked,
          resultsPublic: Boolean(results),
          competing: s.competing,
          overall: result?.rank && results ? { rank: result.rank, of: results.competing.length } : null,
          bestCriterion,
        }),
      };
    });

  return {
    user,
    stats: { jamsJoined, games: gameCount, organized },
    games,
    jams: jamList,
  };
}
