import { db } from "@/lib/db";
import type { ManageRow } from "@/lib/manage";

export interface ManageSubmission extends ManageRow {
  id: string;
  verified: boolean;
  moderationReason: string | null;
  // Distinct raters, not per-criterion scores; null for drafts, which cannot be rated.
  raters: number | null;
}

// Organizers see every entry that is not deleted, drafts and hidden ones included.
export async function loadManageSubmissions(jamId: string): Promise<ManageSubmission[]> {
  const [rows, raterPairs] = await Promise.all([
    db.submission.findMany({
      where: { jamId },
      select: {
        id: true, title: true, status: true, visible: true, rateable: true, competing: true,
        verified: true, moderationReason: true,
        members: {
          select: { user: { select: { username: true, displayName: true } } },
          orderBy: { isLeader: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.rating.groupBy({
      by: ["submissionId", "userId"],
      // Relation filters bypass the soft-delete extension.
      where: { submission: { jamId, deletedAt: null } },
    }),
  ]);
  const raters = new Map<string, number>();
  for (const p of raterPairs) raters.set(p.submissionId, (raters.get(p.submissionId) ?? 0) + 1);

  return rows.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    visible: s.visible,
    rateable: s.rateable,
    competing: s.competing,
    verified: s.verified,
    moderationReason: s.moderationReason,
    team: s.members.map((m) => m.user.displayName ?? m.user.username),
    raters: s.status === "SUBMITTED" ? (raters.get(s.id) ?? 0) : null,
  }));
}
