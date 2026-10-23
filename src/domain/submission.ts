import { allow, deny, type Decision } from "@/domain/decision";
import type { JamPhase } from "@/domain/jam-phase";

export function canCreateSubmission(input: {
  phase: JamPhase;
  hasJoined: boolean;
  hasSubmission: boolean;
}): Decision {
  if (input.phase !== "ONGOING") {
    return deny("Submissions are only accepted during the ongoing period");
  }
  if (!input.hasJoined) return deny("You must join this jam before submitting");
  if (input.hasSubmission) return deny("You already have a submission in this jam");
  return allow;
}

// Spec §5: the team edits while the jam is ONGOING, then content locks.
// Organizers holding `edit_submission` keep editing rights for moderation.
export function canEditSubmission(input: {
  phase: JamPhase;
  isMember: boolean;
  canEditAny: boolean;
}): Decision {
  if (input.canEditAny) return allow;
  if (!input.isMember) return deny("You do not have permission to edit this submission");
  if (input.phase !== "ONGOING") {
    return deny("Submissions can only be edited during the ongoing period");
  }
  return allow;
}

// Spec §5 submission lifecycle: DRAFT → SUBMITTED needs a verified itch.io
// link and every required field, before the deadline.
export function canFinalizeSubmission(input: {
  phase: JamPhase;
  hasItchUrl: boolean;
  verified: boolean;
  missingRequiredFields: string[];
}): Decision {
  if (input.phase !== "ONGOING") {
    return deny("Submissions can only be finalized during the ongoing period");
  }
  if (!input.hasItchUrl) return deny("Add your itch.io project link before submitting");
  if (!input.verified) {
    return deny("Verify ownership of your itch.io project before submitting");
  }
  if (input.missingRequiredFields.length > 0) {
    return deny(
      `Fill in all required fields before submitting: ${input.missingRequiredFields.join(", ")}`
    );
  }
  return allow;
}

export function canUnsubmit(input: { phase: JamPhase }): Decision {
  if (input.phase !== "ONGOING") {
    return deny("Submissions can only be withdrawn during the ongoing period");
  }
  return allow;
}

interface TeamContext {
  phase: JamPhase;
  ranked: boolean;
  allowContributorsAfterClose: boolean;
  // Contributors have the same rights as the leader (spec §5), so any member
  // may manage the roster.
  isMember: boolean;
}

type WindowInput = Pick<TeamContext, "phase" | "ranked" | "allowContributorsAfterClose">;

// Spec §5 contributor change window: free changes while ONGOING; afterwards,
// additions only (never removals) through RATING when the jam allows it.
export function isContributorWindowOpen(input: WindowInput): boolean {
  const openAfterClose =
    input.phase === "RATING" && input.ranked && input.allowContributorsAfterClose;
  return input.phase === "ONGOING" || openAfterClose;
}

const WINDOW_CLOSED = "Contributors can no longer be added to this submission";

// Spec §5: members invite, the invitee accepts. Pending invites hold a seat so a
// full team cannot over-invite.
export function canInviteContributor(
  input: TeamContext & {
    teamSize: number;
    pendingInvites: number;
    maxTeamSize: number | null;
    invitee: { hasJoined: boolean; hasLiveSubmission: boolean; alreadyInvited: boolean };
  }
): Decision {
  if (!input.isMember) return deny("Only team members can invite contributors");
  if (!isContributorWindowOpen(input)) return deny(WINDOW_CLOSED);
  if (!input.invitee.hasJoined) return deny("User must join the jam first");
  if (input.invitee.hasLiveSubmission) {
    return deny("User is already part of a submission in this jam");
  }
  if (input.invitee.alreadyInvited) return deny("User is already invited to this submission");
  if (input.maxTeamSize && input.teamSize + input.pendingInvites >= input.maxTeamSize) {
    return deny("Team is already at maximum size");
  }
  return allow;
}

// The invitee's side, re-checked at accept time: the world may have changed since the invite.
// Only members count here; other pending invites do not hold a seat against an accept.
export function canAcceptInvite(
  input: WindowInput & {
    hasJoined: boolean;
    hasLiveSubmission: boolean;
    teamSize: number;
    maxTeamSize: number | null;
  }
): Decision {
  if (!isContributorWindowOpen(input)) return deny(WINDOW_CLOSED);
  if (!input.hasJoined) return deny("You must join this jam first");
  if (input.hasLiveSubmission) return deny("You already have a submission in this jam");
  if (input.maxTeamSize && input.teamSize >= input.maxTeamSize) {
    return deny("Team is already at maximum size");
  }
  return allow;
}

export function canRemoveContributor(
  input: TeamContext & { targetIsLeader: boolean }
): Decision {
  if (!input.isMember) return deny("Only team members can remove contributors");
  if (input.phase !== "ONGOING") {
    return deny("Cannot remove contributors after submissions close");
  }
  if (input.targetIsLeader) return deny("Cannot remove the team leader");
  return allow;
}

// Leadership is handed over by the current leader; equal rights over the
// submission do not extend to taking leadership from someone else.
export function canTransferLeadership(input: {
  isLeader: boolean;
  targetIsMember: boolean;
}): Decision {
  if (!input.isLeader) return deny("Only the team leader can transfer leadership");
  if (!input.targetIsMember) return deny("User is not on this team");
  return allow;
}

// Spec §4: a team leader may delete the submission (to leave the jam) while it is ONGOING;
// organizers and staff delete through their own permissions.
export function canDeleteOwnSubmission(input: { phase: JamPhase; isLeader: boolean }): Decision {
  if (!input.isLeader) return deny("Only the team leader can delete this submission");
  if (input.phase !== "ONGOING") {
    return deny("Submissions can only be deleted during the ongoing period");
  }
  return allow;
}
