import { cache } from "react";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { jamPhase, type JamPhase } from "@/domain/jam-phase";
import { resultsAccess } from "@/domain/results";

const LIVE_SUBMISSIONS = { status: "SUBMITTED", visible: true, deletedAt: null } as const;

async function findJam(slug: string) {
  return db.jam.findUnique({
    where: { slug },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      roles: { include: { user: { select: { username: true, displayName: true, avatarUrl: true } } } },
      criteria: {
        select: { id: true, name: true, description: true, weight: true, isPrimary: true, source: true },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { participants: true, submissions: { where: LIVE_SUBMISSIONS } } },
    },
  });
}

export interface JamViewer {
  userId: string | null;
  roles: ("ADMIN" | "MODERATOR" | "JUDGE" | "HOST")[];
  canEditJam: boolean;
  canManageRoles: boolean;
  canModerate: boolean;
  canPreviewResults: boolean;
  hasJoined: boolean;
  submission: { id: string; status: "DRAFT" | "SUBMITTED" } | null;
}
export interface JamPageData {
  jam: NonNullable<Awaited<ReturnType<typeof findJam>>>;
  phase: JamPhase;
  viewer: JamViewer;
  resultsVisible: boolean;
}

// Wrapped in React cache() so the header, the tab body and generateMetadata share one
// query per request.
export const loadJamPage = cache(async (slug: string, userId: string | null): Promise<JamPageData | null> => {
  const jam = await findJam(slug);
  if (!jam) return null;
  const phase = jamPhase(jam);
  const roles = userId ? jam.roles.filter((r) => r.userId === userId).map((r) => r.role) : [];
  if (phase === "DRAFT" && roles.length === 0) return null;

  const [participant, member] = userId
    ? await Promise.all([
        db.jamParticipant.findUnique({ where: { jamId_userId: { jamId: jam.id, userId } } }),
        db.submissionMember.findFirst({
          where: { userId, submission: { jamId: jam.id, deletedAt: null } },
          select: { submission: { select: { id: true, status: true } } },
        }),
      ])
    : [null, null];

  const canPreviewResults = hasPermission(roles, "preview_results");
  return {
    jam,
    phase,
    viewer: {
      userId,
      roles,
      canEditJam: hasPermission(roles, "edit_jam"),
      canManageRoles: hasPermission(roles, "manage_roles"),
      canModerate: hasPermission(roles, "edit_submission"),
      canPreviewResults,
      hasJoined: Boolean(participant),
      submission: member?.submission ?? null,
    },
    resultsVisible: resultsAccess({ ...jam, phase, canPreview: canPreviewResults }) !== "none",
  };
});
