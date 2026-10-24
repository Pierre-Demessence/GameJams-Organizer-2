import type { JamPhase } from "@/domain/jam-phase";

// Spec §3 "Deleting your account". Pure rules over plain data: the loader reads it, the action
// applies the returned operations.

export interface AccountMembership {
  submissionId: string;
  title: string;
  phase: JamPhase;
  isLeader: boolean;
  // Everyone on the team, the user included.
  memberCount: number;
  submissionDeletedAt: Date | null;
}

export interface AccountJamRole {
  jamId: string;
  slug: string;
  name: string;
  role: "ADMIN" | "MODERATOR" | "JUDGE" | "HOST";
  phase: JamPhase;
  publishedAt: Date | null;
  // Holders of the ADMIN role in that jam, the user included.
  adminCount: number;
}

export interface AccountParticipation {
  jamId: string;
  phase: JamPhase;
}

export interface AccountDeletionInput {
  userId: string;
  isStaff: boolean;
  memberships: AccountMembership[];
  jamRoles: AccountJamRole[];
  participations: AccountParticipation[];
}

export type AccountBlocker =
  | { kind: "LED_TEAM"; id: string; name: string; reason: string }
  | { kind: "SOLE_ADMIN"; id: string; name: string; reason: string; slug: string }
  | { kind: "STAFF"; id: string; name: string; reason: string };

export interface AccountDeletionOps {
  removeMembershipSubmissionIds: string[];
  softDeleteSubmissionIds: string[];
  softDeleteJamIds: string[];
  removeParticipationJamIds: string[];
}

export interface AccountDeletionPreview {
  // Rows the deletion removes or soft-deletes, with names for the confirmation screen.
  leavingTeams: { id: string; title: string }[];
  deletedSubmissions: { id: string; title: string }[];
  deletedJams: { id: string; name: string }[];
  leavingJams: number;
  roles: number;
  // Memberships in RATING / FINISHED jams: frozen so results and team sizes do not change.
  keptMemberships: number;
}

export type AccountDeletionPlan =
  // The preview of what would happen once the blockers are resolved, for the settings page.
  | { allowed: false; blockers: AccountBlocker[]; preview: AccountDeletionPreview }
  | { allowed: true; ops: AccountDeletionOps; preview: AccountDeletionPreview };

// Rosters and participation freeze when submissions close, so only the phases before RATING
// can still change.
const isBeforeRating = (phase: JamPhase) =>
  phase === "DRAFT" || phase === "UPCOMING" || phase === "ONGOING";

export function planAccountDeletion(input: AccountDeletionInput): AccountDeletionPlan {
  const blockers: AccountBlocker[] = [];
  const ops: AccountDeletionOps = {
    removeMembershipSubmissionIds: [],
    softDeleteSubmissionIds: [],
    softDeleteJamIds: [],
    removeParticipationJamIds: [],
  };
  const preview: AccountDeletionPreview = {
    leavingTeams: [],
    deletedSubmissions: [],
    deletedJams: [],
    leavingJams: 0,
    roles: input.jamRoles.length,
    keptMemberships: 0,
  };

  if (input.isStaff) {
    blockers.push({
      kind: "STAFF",
      id: input.userId,
      name: "Staff role",
      reason: "Ask another admin to remove your staff role first",
    });
  }

  // A trashed submission is already out of play; its membership stays untouched.
  for (const m of input.memberships) {
    if (m.submissionDeletedAt) continue;
    if (!isBeforeRating(m.phase)) {
      preview.keptMemberships += 1;
    } else if (!m.isLeader) {
      ops.removeMembershipSubmissionIds.push(m.submissionId);
      preview.leavingTeams.push({ id: m.submissionId, title: m.title });
    } else if (m.memberCount > 1) {
      blockers.push({
        kind: "LED_TEAM",
        id: m.submissionId,
        name: m.title,
        reason: `Transfer leadership of ${m.title} first`,
      });
    } else {
      ops.softDeleteSubmissionIds.push(m.submissionId);
      preview.deletedSubmissions.push({ id: m.submissionId, title: m.title });
    }
  }

  for (const r of input.jamRoles) {
    if (r.role !== "ADMIN" || r.adminCount > 1) continue;
    if (!r.publishedAt) {
      ops.softDeleteJamIds.push(r.jamId);
      preview.deletedJams.push({ id: r.jamId, name: r.name });
    } else if (r.phase !== "FINISHED") {
      blockers.push({
        kind: "SOLE_ADMIN",
        id: r.jamId,
        name: r.name,
        slug: r.slug,
        reason: `Add another Jam Admin to ${r.name} first, or wait until it has finished`,
      });
    }
  }

  for (const p of input.participations) {
    if (!isBeforeRating(p.phase)) continue;
    ops.removeParticipationJamIds.push(p.jamId);
    preview.leavingJams += 1;
  }

  if (blockers.length > 0) return { allowed: false, blockers, preview };
  return { allowed: true, ops, preview };
}
