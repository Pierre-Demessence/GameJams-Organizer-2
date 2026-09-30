import { allow, deny, type Decision } from "@/domain/decision";
import type { JamPhase } from "@/domain/jam-phase";
import type { JamResults, SubmissionResult } from "@/domain/scoring";

export type ResultsAccess = "none" | "preview" | "public";

interface ResultsContext {
  ranked: boolean;
  phase: JamPhase;
  hideResults: boolean;
  resultsRevealedAt: Date | null;
}

export function resultsArePublic(ctx: ResultsContext): boolean {
  return (
    ctx.ranked &&
    ctx.phase === "FINISHED" &&
    (!ctx.hideResults || ctx.resultsRevealedAt !== null)
  );
}

// Spec §6.5: results go public when the jam finishes, unless "hide results"
// holds them back until an organizer reveals them. Organizers can preview from
// the start of rating; nobody else sees live standings, which would sway votes.
export function resultsAccess(
  ctx: ResultsContext & { canPreview: boolean }
): ResultsAccess {
  if (resultsArePublic(ctx)) return "public";
  if (ctx.ranked && ctx.canPreview && (ctx.phase === "RATING" || ctx.phase === "FINISHED")) {
    return "preview";
  }
  return "none";
}

export function canRevealResults(ctx: ResultsContext): Decision {
  if (!ctx.ranked) return deny("This jam is not ranked");
  if (ctx.phase !== "FINISHED") return deny("Results can only be revealed once the jam has finished");
  if (!ctx.hideResults || ctx.resultsRevealedAt) return deny("Results are already public");
  return allow;
}

// Unrated entries get the prior mean and a random tiebreak, so they must not be shown as
// winners.
export function podium(results: JamResults, size = 3): SubmissionResult[] {
  if (!results.hasOverall) return [];
  return results.competing
    .filter((r) => r.rank !== null && r.totalRatings > 0)
    .sort((a, b) => (a.rank as number) - (b.rank as number))
    .slice(0, size);
}
