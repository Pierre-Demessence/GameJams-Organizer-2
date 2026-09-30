import { allow, deny, type Decision } from "@/domain/decision";
import type { JamPhase } from "@/domain/jam-phase";

// Spec §4.7: joining is open until submissions close.
export function canJoin(input: { phase: JamPhase; hasJoined: boolean }): Decision {
  if (input.hasJoined) return deny("You have already joined this jam");
  if (input.phase !== "UPCOMING" && input.phase !== "ONGOING") {
    return deny("You can only join jams that are upcoming or ongoing");
  }
  return allow;
}

// Spec §4.7: only a Joined user who is not in a submission can leave. The
// theme-vote lock applies once theme voting exists.
export function canLeaveJam(input: { hasJoined: boolean; isParticipant: boolean }): Decision {
  if (!input.hasJoined) return deny("You have not joined this jam");
  if (input.isParticipant) return deny("Leave your submission before leaving the jam");
  return allow;
}

// Spec §4.7: rosters freeze when submissions close, and a leader must hand
// over leadership (or delete the submission) first.
export function canLeaveSubmission(input: { phase: JamPhase; isLeader: boolean }): Decision {
  if (input.phase !== "ONGOING") {
    return deny("Teams can only change while the jam is ongoing");
  }
  if (input.isLeader) {
    return deny("Transfer leadership or delete the submission before leaving");
  }
  return allow;
}
