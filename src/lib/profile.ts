import type { JamPhase } from "@/domain/jam-phase";
import { jamRoleLabel } from "@/lib/jam-labels";

type JamRole = "ADMIN" | "MODERATOR" | "JUDGE" | "HOST";

export interface Placement {
  label: string;
  // Podium places and open rating are shown in the rating color.
  highlight: boolean;
}

export interface PlacementInput {
  phase: JamPhase;
  ranked: boolean;
  resultsPublic: boolean;
  competing: boolean;
  // Overall rank and the number of competing entries; null without an overall ranking.
  overall: { rank: number; of: number } | null;
  // The entry's best per-criterion rank.
  bestCriterion: { name: string; rank: number } | null;
}

const PODIUM = 3;

// A podium place on one criterion says more than a mid-table overall rank, so it wins
// unless the overall itself is on the podium.
export function placement(input: PlacementInput): Placement | null {
  if (!input.ranked) return input.phase === "FINISHED" ? { label: "Showcase", highlight: false } : null;
  if (input.phase === "RATING") return { label: "In rating", highlight: true };
  if (input.phase !== "FINISHED" || !input.resultsPublic) return null;
  if (!input.competing) return { label: "Not competing", highlight: false };

  const { overall, bestCriterion } = input;
  if (overall && overall.rank <= PODIUM) return { label: `#${overall.rank} of ${overall.of}`, highlight: true };
  if (bestCriterion && bestCriterion.rank <= PODIUM) {
    return { label: `#${bestCriterion.rank} ${bestCriterion.name}`, highlight: true };
  }
  if (overall) return { label: `#${overall.rank} of ${overall.of}`, highlight: false };
  if (bestCriterion) return { label: `#${bestCriterion.rank} ${bestCriterion.name}`, highlight: false };
  return null;
}

const ROLE_ORDER: JamRole[] = ["ADMIN", "HOST", "MODERATOR", "JUDGE"];

export function jamRoleSummary(participant: boolean, roles: JamRole[]): string {
  const labels = ROLE_ORDER.filter((r) => roles.includes(r)).map(jamRoleLabel);
  return [...(participant ? ["Participant"] : []), ...labels].join(" · ");
}

export function teamLine(teammates: string[]): string {
  return teammates.length > 0 ? `with ${teammates.join(", ")}` : "solo";
}

const MONTH = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });

export function memberSince(createdAt: Date): string {
  return MONTH.format(createdAt);
}

// Live first, then rating, upcoming and finished, as a dashboard of what matters now.
const PHASE_ORDER: Record<JamPhase, number> = { ONGOING: 0, RATING: 1, UPCOMING: 2, FINISHED: 3, DRAFT: 4 };

export function compareJams(
  a: { phase: JamPhase; startDate: Date | null },
  b: { phase: JamPhase; startDate: Date | null }
): number {
  return (
    PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] ||
    (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0)
  );
}
