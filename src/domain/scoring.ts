import { createHash } from "crypto";

export interface ScoringCriterion {
  id: string;
  weight: number;
  source: "RATED" | "JURY";
  isPrimary: boolean;
}

export interface ScoringSubmission {
  id: string;
  competing: boolean;
}

export interface ScoringRating {
  submissionId: string;
  criterionId: string;
  score: number;
}

export interface CriterionScore {
  raw: number;
  weighted: number;
  count: number;
  rank: number | null;
}

export interface SubmissionResult {
  submissionId: string;
  competing: boolean;
  // Null when the jam has no overall ranking, and for non-competing entries.
  rank: number | null;
  finalScore: number | null;
  totalRatings: number;
  rawAverage: number;
  criteriaScores: Record<string, CriterionScore>;
}

export interface JamResults {
  hasOverall: boolean;
  competing: SubmissionResult[];
  // Rank-excluded entries that were rated, shown apart from the ranking (spec §6.5).
  notCompeting: SubmissionResult[];
}

const EPSILON = 1e-9;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Stable pseudo-random tiebreaker so the same data always ranks the same way.
function deterministicRandom(submissionId: string): number {
  const hash = createHash("sha256").update(submissionId).digest("hex");
  return parseInt(hash.slice(0, 8), 16) / 0xffffffff;
}

function compareDesc(a: number, b: number): number {
  return Math.abs(b - a) > EPSILON ? b - a : 0;
}

// Spec §6.4 tiebreaks: more ratings → higher raw average → deterministic random.
function tiebreak(
  a: { submissionId: string; count: number; raw: number },
  b: { submissionId: string; count: number; raw: number }
): number {
  return (
    b.count - a.count ||
    compareDesc(a.raw, b.raw) ||
    deterministicRandom(b.submissionId) - deterministicRandom(a.submissionId)
  );
}

// Spec §6.4. Per RATED criterion c, each submission gets a Bayesian weighted
// score WS_c = (v·R_c + m·C_c) / (v + m), where C_c is the mean over competing
// entries and m the median rating count, so a lone 5/5 cannot top a well-rated
// entry. The overall is the primary criterion's ranking when one is set, else
// the weighted average of WS_c over RATED criteria with non-zero weight.
export function rankSubmissions(input: {
  criteria: ScoringCriterion[];
  submissions: ScoringSubmission[];
  ratings: ScoringRating[];
}): JamResults {
  const rated = input.criteria.filter((c) => c.source === "RATED");
  const weighted = rated.filter((c) => c.weight > 0);
  const primary =
    rated.find((c) => c.isPrimary) ??
    (input.criteria.length === 1 && rated.length === 1 ? rated[0] : null);
  const hasOverall = primary !== null || weighted.length > 0;

  const scores = new Map<string, Map<string, number[]>>();
  for (const r of input.ratings) {
    const bySubmission = scores.get(r.submissionId) ?? new Map<string, number[]>();
    scores.set(r.submissionId, bySubmission);
    const list = bySubmission.get(r.criterionId) ?? [];
    bySubmission.set(r.criterionId, list);
    list.push(r.score);
  }
  const scoresOf = (submissionId: string, criterionId: string) =>
    scores.get(submissionId)?.get(criterionId) ?? [];

  const competingSubs = input.submissions.filter((s) => s.competing);
  const stats = new Map<string, { globalMean: number; m: number }>();
  for (const c of rated) {
    const all = competingSubs.flatMap((s) => scoresOf(s.id, c.id));
    stats.set(c.id, {
      // With no ratings at all, the scale midpoint is the only neutral prior.
      globalMean: all.length > 0 ? mean(all) : 3,
      m: median(competingSubs.map((s) => scoresOf(s.id, c.id).length)),
    });
  }

  function score(sub: ScoringSubmission): SubmissionResult {
    const criteriaScores: Record<string, CriterionScore> = {};
    let weightedSum = 0;
    let totalWeight = 0;
    let totalRatings = 0;
    const rawMeans: number[] = [];

    for (const c of rated) {
      const list = scoresOf(sub.id, c.id);
      const v = list.length;
      const raw = v > 0 ? mean(list) : 0;
      const { globalMean, m } = stats.get(c.id)!;
      const ws = v + m > 0 ? (v * raw + m * globalMean) / (v + m) : globalMean;
      criteriaScores[c.id] = { raw, weighted: ws, count: v, rank: null };
      totalRatings += v;
      if (v > 0) rawMeans.push(raw);
      if (c.weight > 0) {
        weightedSum += ws * c.weight;
        totalWeight += c.weight;
      }
    }

    const finalScore = !hasOverall
      ? null
      : primary
        ? criteriaScores[primary.id].weighted
        : weightedSum / totalWeight;

    return {
      submissionId: sub.id,
      competing: sub.competing,
      rank: null,
      finalScore,
      totalRatings,
      rawAverage: rawMeans.length > 0 ? mean(rawMeans) : 0,
      criteriaScores,
    };
  }

  const competing = competingSubs.map(score);

  for (const c of rated) {
    const ordered = [...competing].sort((a, b) => {
      const ca = a.criteriaScores[c.id];
      const cb = b.criteriaScores[c.id];
      return (
        compareDesc(ca.weighted, cb.weighted) ||
        tiebreak(
          { submissionId: a.submissionId, count: ca.count, raw: ca.raw },
          { submissionId: b.submissionId, count: cb.count, raw: cb.raw }
        )
      );
    });
    ordered.forEach((r, i) => {
      r.criteriaScores[c.id].rank = i + 1;
    });
  }

  if (hasOverall) {
    competing.sort(
      (a, b) =>
        compareDesc(a.finalScore!, b.finalScore!) ||
        tiebreak(
          { submissionId: a.submissionId, count: a.totalRatings, raw: a.rawAverage },
          { submissionId: b.submissionId, count: b.totalRatings, raw: b.rawAverage }
        )
    );
    competing.forEach((r, i) => {
      r.rank = i + 1;
    });
  }

  const notCompeting = input.submissions
    .filter((s) => !s.competing)
    .map(score)
    .filter((r) => r.totalRatings > 0);

  return { hasOverall, competing, notCompeting };
}
