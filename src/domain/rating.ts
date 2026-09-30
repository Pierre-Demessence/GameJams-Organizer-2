import { allow, deny, type Decision } from "@/domain/decision";
import type { JamPhase } from "@/domain/jam-phase";

export type RatingEligibility =
  | "SUBMITTERS_ONLY"
  | "SUBMITTERS_AND_CONTRIBUTORS"
  | "JUDGES_ONLY"
  | "EVERYONE";

export interface Rater {
  isJudge: boolean;
  // Membership in a SUBMITTED, non-deleted submission of this jam. Drafts and
  // deleted entries never make someone eligible.
  membership: { isLeader: boolean } | null;
}

// Spec §6.1 plus §4.6: judges may always rate, even without a submission.
export function isEligibleRater(eligibility: RatingEligibility, rater: Rater): boolean {
  if (rater.isJudge) return true;
  switch (eligibility) {
    case "EVERYONE":
      return true;
    case "JUDGES_ONLY":
      return false;
    case "SUBMITTERS_ONLY":
      return rater.membership?.isLeader === true;
    case "SUBMITTERS_AND_CONTRIBUTORS":
      return rater.membership !== null;
  }
}

export function canRate(input: {
  phase: JamPhase;
  ranked: boolean;
  eligibility: RatingEligibility;
  rater: Rater;
  isOwnSubmission: boolean;
  submission: { status: "DRAFT" | "SUBMITTED"; rateable: boolean };
}): Decision {
  if (!input.ranked) return deny("This jam is not ranked");
  if (input.phase !== "RATING") {
    return deny("Ratings are only accepted during the rating period");
  }
  if (input.submission.status !== "SUBMITTED") {
    return deny("This submission is not finalized");
  }
  if (!input.submission.rateable) return deny("This submission cannot be rated");
  if (input.isOwnSubmission) return deny("You cannot rate your own submission");
  if (!isEligibleRater(input.eligibility, input.rater)) {
    return deny("You are not eligible to rate in this jam");
  }
  return allow;
}
