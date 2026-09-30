import { allow, deny, type Decision } from "@/domain/decision";

export type JamPhase = "DRAFT" | "UPCOMING" | "ONGOING" | "RATING" | "FINISHED";

export interface JamPhaseInput {
  publishedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  ratingEnd: Date | null;
  ranked: boolean;
}

// Spec §4.4: a draft never progresses; once published, the phase is derived
// from the dates. Each phase starts at the instant the previous one ends.
export function jamPhase(jam: JamPhaseInput, now = new Date()): JamPhase {
  if (!jam.publishedAt || !jam.startDate || !jam.endDate) return "DRAFT";
  if (now < jam.startDate) return "UPCOMING";
  if (now < jam.endDate) return "ONGOING";
  if (jam.ranked && jam.ratingEnd && now < jam.ratingEnd) return "RATING";
  return "FINISHED";
}

interface JamDates {
  startDate: Date | null;
  endDate: Date | null;
  ratingEnd: Date | null;
  ranked: boolean;
}

// Drafts may hold partial dates; `requireComplete` is set for published jams,
// whose phase would otherwise silently fall back to DRAFT.
export function validateJamDates(
  jam: JamDates,
  { requireComplete }: { requireComplete: boolean }
): Decision {
  const { startDate, endDate, ratingEnd, ranked } = jam;
  if (requireComplete) {
    if (!startDate || !endDate) return deny("Start date and end date are required");
    if (ranked && !ratingEnd) return deny("Rating end date is required for ranked jams");
  }
  if (startDate && endDate && startDate >= endDate) {
    return deny("Start date must be before end date");
  }
  if (ranked && ratingEnd) {
    if (!endDate) return deny("End date is required when rating end date is set");
    if (endDate >= ratingEnd) return deny("End date must be before rating end date");
  }
  return allow;
}

interface PublishCriterion {
  source: "RATED" | "JURY";
  weight: number;
  isPrimary: boolean;
}

// Spec §4.4 (valid dates) and §6.2 (a ranked jam needs at least one criterion,
// and an averaged overall needs a RATED criterion with non-zero weight; an
// all-JURY jam without a primary simply has no overall ranking).
export function canPublish(
  jam: JamDates & { publishedAt: Date | null; criteria: PublishCriterion[] }
): Decision {
  if (jam.publishedAt) return deny("This jam is already published");
  const dates = validateJamDates(jam, { requireComplete: true });
  if (!dates.allowed) return dates;
  if (jam.ranked) {
    if (jam.criteria.length === 0) {
      return deny("A ranked jam needs at least one rating criterion");
    }
    const rated = jam.criteria.filter((c) => c.source === "RATED");
    const hasPrimary = jam.criteria.some((c) => c.isPrimary) || jam.criteria.length === 1;
    const hasWeightedRated = rated.some((c) => c.weight > 0);
    if (!hasPrimary && rated.length > 0 && !hasWeightedRated) {
      return deny(
        "Set a primary criterion or give at least one rated criterion a non-zero weight"
      );
    }
  }
  return allow;
}
