import { db } from "@/lib/db";
import { canRate } from "@/domain/rating";
import { loadRater } from "@/lib/rating-queries";
import type { JamPageData } from "@/lib/jam-page-queries";
import { nextToRate, type EntriesParams, type Platform } from "@/lib/jam-entries";

export interface EntryCard {
  id: string;
  title: string;
  coverUrl: string | null;
  platforms: Platform[];
  team: { username: string; displayName: string | null; isLeader: boolean }[];
  competing: boolean;
  rateable: boolean;
  raters: number;
  ratedByViewer: boolean;
  isViewerTeam: boolean;
  eligible: boolean;
  createdAt: Date;
}
export interface JamEntries {
  hidden: boolean;
  ownOnly: boolean;
  entries: EntryCard[];
  progress: { rated: number; eligible: number; next: string | null } | null;
}

export async function loadJamEntries(data: JamPageData, params: EntriesParams): Promise<JamEntries> {
  const { jam, phase, viewer } = data;
  const userId = viewer.userId;
  // Spec §4.2: while ONGOING the list is hidden; moderators see everything and a team still
  // sees its own entry.
  const restricted = jam.hideSubmissionsBeforeEnd && phase === "ONGOING" && !viewer.canModerate;
  if (restricted && !viewer.submission) return { hidden: true, ownOnly: false, entries: [], progress: null };

  const [rows, raterPairs, rater] = await Promise.all([
    db.submission.findMany({
      where: { jamId: jam.id, status: "SUBMITTED", visible: true, deletedAt: null },
      select: {
        id: true, title: true, coverUrl: true, supportedPlatforms: true, competing: true,
        rateable: true, status: true, createdAt: true,
        members: {
          select: { userId: true, isLeader: true, user: { select: { username: true, displayName: true } } },
          orderBy: { isLeader: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // One row per (submission, rater): ratings exist per criterion, raters are what count.
    db.rating.groupBy({
      by: ["submissionId", "userId"],
      where: { submission: { jamId: jam.id, status: "SUBMITTED", deletedAt: null } },
    }),
    userId && jam.ranked && phase === "RATING" ? loadRater(jam.id, userId) : Promise.resolve(null),
  ]);

  const raters = new Map<string, number>();
  const ratedByViewer = new Set<string>();
  for (const p of raterPairs) {
    raters.set(p.submissionId, (raters.get(p.submissionId) ?? 0) + 1);
    if (p.userId === userId) ratedByViewer.add(p.submissionId);
  }

  const all: EntryCard[] = rows.map((s) => {
    const isViewerTeam = Boolean(userId && s.members.some((m) => m.userId === userId));
    const eligible = rater
      ? canRate({
          phase, ranked: jam.ranked, eligibility: jam.ratingEligibility, rater,
          isOwnSubmission: isViewerTeam, submission: s,
        }).allowed
      : false;
    return {
      id: s.id, title: s.title, coverUrl: s.coverUrl, platforms: s.supportedPlatforms as Platform[],
      team: s.members.map((m) => ({ username: m.user.username, displayName: m.user.displayName, isLeader: m.isLeader })),
      competing: s.competing, rateable: s.rateable, raters: raters.get(s.id) ?? 0,
      ratedByViewer: ratedByViewer.has(s.id), isViewerTeam, eligible, createdAt: s.createdAt,
    };
  });

  const eligibleEntries = all.filter((e) => e.eligible);
  // No card for viewers who cannot rate anything (anonymous, ineligible, or outside RATING).
  const progress =
    rater && eligibleEntries.length > 0
      ? {
          rated: eligibleEntries.filter((e) => e.ratedByViewer).length,
          eligible: eligibleEntries.length,
          next: nextToRate(all),
        }
      : null;

  let entries = restricted ? all.filter((e) => e.isViewerTeam) : all;
  if (params.platforms.length) {
    entries = entries.filter((e) => e.platforms.some((p) => params.platforms.includes(p)));
  }
  if (params.hideRated) entries = entries.filter((e) => !e.ratedByViewer);
  entries = [...entries].sort((a, b) => {
    if (params.sort === "title") return a.title.localeCompare(b.title);
    if (params.sort === "fewest") return a.raters - b.raters || a.createdAt.getTime() - b.createdAt.getTime();
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return { hidden: false, ownOnly: restricted, entries, progress };
}
