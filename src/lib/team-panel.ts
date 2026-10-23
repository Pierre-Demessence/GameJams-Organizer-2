import type { JamPhase } from "@/domain/jam-phase";
import { canLeaveSubmission } from "@/domain/participation";
import { canRemoveContributor, isContributorWindowOpen } from "@/domain/submission";

// What the team panel offers a viewer. Whether a specific invitee is allowed is decided by
// `canInviteContributor` when the invite is sent, so `canInvite` only says the form is worth showing.
export function teamPanelState(input: {
  phase: JamPhase;
  ranked: boolean;
  allowContributorsAfterClose: boolean;
  isMember: boolean;
  isLeader: boolean;
}) {
  const leave = canLeaveSubmission({ phase: input.phase, isLeader: input.isLeader });
  return {
    canInvite: input.isMember && isContributorWindowOpen(input),
    canRemove: canRemoveContributor({ ...input, targetIsLeader: false }).allowed,
    canLeave: input.isMember && leave.allowed,
    // A leader outside ONGOING cannot leave for a different reason (frozen roster), which needs no hint.
    leaveHint:
      input.isMember && input.isLeader && !leave.allowed && input.phase === "ONGOING"
        ? leave.reason
        : null,
  };
}
