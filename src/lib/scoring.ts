import { db } from "@/lib/db";
import { createHash } from "crypto";

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Deterministic tiebreaker based on submission ID
function deterministicRandom(submissionId: string): number {
  const hash = createHash("sha256").update(submissionId).digest("hex");
  return parseInt(hash.slice(0, 8), 16) / 0xffffffff;
}

export async function computeJamResults(jamId: string) {
  // Clear any prior ranking first, so recomputing after all entries are
  // disqualified (or criteria removed) does not leave a stale ranking behind.
  await db.jamResult.deleteMany({ where: { jamId } });

  const criteria = await db.criterion.findMany({
    where: { jamId },
  });

  // MVP: only RATED criteria are aggregated from ratings.
  const ratedCriteria = criteria.filter((c) => c.source === "RATED");
  const scoredCriteria = ratedCriteria.filter((c) => c.weight > 0);

  // Primary determines the overall ranking; a lone criterion is primary by default.
  const primary =
    ratedCriteria.find((c) => c.isPrimary) ??
    (criteria.length === 1 && ratedCriteria.length === 1
      ? ratedCriteria[0]
      : null);

  // No overall ranking is possible without a primary or a weighted criterion.
  if (!primary && scoredCriteria.length === 0) return;

  // Submissions that compete in the official ranking.
  const submissions = await db.submission.findMany({
    where: { jamId, status: "SUBMITTED", competing: true },
    select: { id: true },
  });

  if (submissions.length === 0) return;

  // Include non-competing submissions' ratings too, so "Not competing" entries can
  // display scores; the global stats below are still computed from competing entries only.
  const allRatings = await db.rating.findMany({
    where: {
      submission: { jamId, status: "SUBMITTED" },
    },
  });

  // Group ratings by submission and criterion
  const ratingMap = new Map<string, Map<string, number[]>>();
  for (const r of allRatings) {
    if (!ratingMap.has(r.submissionId)) {
      ratingMap.set(r.submissionId, new Map());
    }
    const subMap = ratingMap.get(r.submissionId)!;
    if (!subMap.has(r.criterionId)) {
      subMap.set(r.criterionId, []);
    }
    subMap.get(r.criterionId)!.push(r.score);
  }

  // Step 2: For each criterion, compute C_c (global mean) and m (median ratings count)
  const criterionStats = new Map<
    string,
    { globalMean: number; medianCount: number }
  >();

  for (const c of ratedCriteria) {
    const allScores: number[] = [];
    const ratingsPerSubmission: number[] = [];

    for (const sub of submissions) {
      const subRatings = ratingMap.get(sub.id)?.get(c.id) ?? [];
      ratingsPerSubmission.push(subRatings.length);
      allScores.push(...subRatings);
    }

    const globalMean =
      allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 3; // Default to midpoint if no ratings
    const medianCount = median(ratingsPerSubmission);

    criterionStats.set(c.id, { globalMean, medianCount });
  }

  // Step 3-4: Compute weighted scores for each submission
  type CriterionScore = {
    raw: number;
    weighted: number;
    count: number;
    rank: number | null;
  };
  type ScoredSubmission = {
    submissionId: string;
    finalScore: number;
    totalRatings: number;
    rawAverage: number;
    criteriaScores: Record<string, CriterionScore>;
  };

  function scoreSubmission(subId: string): ScoredSubmission {
    const subRatings = ratingMap.get(subId) ?? new Map<string, number[]>();
    let weightedSum = 0;
    let totalWeight = 0;
    let totalRatingCount = 0;
    let rawScoreSum = 0;
    let rawScoreCount = 0;
    const criteriaScores: Record<string, CriterionScore> = {};

    for (const c of ratedCriteria) {
      const scores = subRatings.get(c.id) ?? [];
      const v = scores.length;
      totalRatingCount += v;
      const R_c = v > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / v : 0;

      if (v > 0) {
        rawScoreSum += R_c;
        rawScoreCount++;
      }

      const stats = criterionStats.get(c.id)!;
      const m = stats.medianCount;
      const C_c = stats.globalMean;

      // Bayesian weighted score
      const WS_c = (v * R_c + m * C_c) / (v + m || 1);

      criteriaScores[c.id] = { raw: R_c, weighted: WS_c, count: v, rank: null };

      if (c.weight > 0) {
        weightedSum += WS_c * c.weight;
        totalWeight += c.weight;
      }
    }

    // Primary set → overall equals that criterion's score; else weighted average.
    const finalScore = primary
      ? (criteriaScores[primary.id]?.weighted ?? 0)
      : totalWeight > 0
        ? weightedSum / totalWeight
        : 0;
    const rawAverage = rawScoreCount > 0 ? rawScoreSum / rawScoreCount : 0;

    return {
      submissionId: subId,
      finalScore,
      totalRatings: totalRatingCount,
      rawAverage,
      criteriaScores,
    };
  }

  const EPSILON = 1e-9;
  const competingResults = submissions.map((sub) => scoreSubmission(sub.id));

  // Per-criterion ranking among competing submissions (spec §6.4, design step 2d).
  for (const c of ratedCriteria) {
    const ordered = [...competingResults].sort((a, b) => {
      const aw = a.criteriaScores[c.id]?.weighted ?? 0;
      const bw = b.criteriaScores[c.id]?.weighted ?? 0;
      if (Math.abs(bw - aw) > EPSILON) return bw - aw;
      const ac = a.criteriaScores[c.id]?.count ?? 0;
      const bc = b.criteriaScores[c.id]?.count ?? 0;
      if (bc !== ac) return bc - ac;
      return (
        deterministicRandom(b.submissionId) -
        deterministicRandom(a.submissionId)
      );
    });
    ordered.forEach((r, index) => {
      const cs = r.criteriaScores[c.id];
      if (cs) cs.rank = index + 1;
    });
  }

  // Step 5-6: Sort the overall ranking with tiebreakers
  competingResults.sort((a, b) => {
    if (Math.abs(b.finalScore - a.finalScore) > EPSILON) return b.finalScore - a.finalScore;
    if (b.totalRatings !== a.totalRatings)
      return b.totalRatings - a.totalRatings;
    if (Math.abs(b.rawAverage - a.rawAverage) > EPSILON) return b.rawAverage - a.rawAverage;
    return (
      deterministicRandom(b.submissionId) -
      deterministicRandom(a.submissionId)
    );
  });

  // Rated but rank-excluded submissions (spec §6.5 "Not competing"): scored for
  // display using the competing cohort's stats, but never ranked.
  const nonCompeting = await db.submission.findMany({
    where: {
      jamId,
      status: "SUBMITTED",
      competing: false,
      ratings: { some: {} },
    },
    select: { id: true },
  });
  const nonCompetingResults = nonCompeting.map((sub) => scoreSubmission(sub.id));

  // Step 7: Store results — delete old then bulk create
  await db.$transaction([
    db.jamResult.deleteMany({ where: { jamId } }),
    ...competingResults.map((r, index) =>
      db.jamResult.create({
        data: {
          jamId,
          submissionId: r.submissionId,
          rank: index + 1,
          competing: true,
          finalScore: r.finalScore,
          totalRatings: r.totalRatings,
          rawAverage: r.rawAverage,
          criteriaScores: r.criteriaScores,
        },
      })
    ),
    ...nonCompetingResults.map((r) =>
      db.jamResult.create({
        data: {
          jamId,
          submissionId: r.submissionId,
          rank: null,
          competing: false,
          finalScore: r.finalScore,
          totalRatings: r.totalRatings,
          rawAverage: r.rawAverage,
          criteriaScores: r.criteriaScores,
        },
      })
    ),
  ]);
}
