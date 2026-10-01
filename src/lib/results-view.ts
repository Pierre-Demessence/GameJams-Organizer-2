import type { JamResults, SubmissionResult } from "@/domain/scoring";

export interface RankingRow {
  submissionId: string;
  rank: number;
  score: number;
  raw: number;
  ratings: number;
}
export interface RankingView {
  podium: RankingRow[];
  rest: RankingRow[];
}
export interface ResultsParams {
  // null = the overall ranking.
  criterionId: string | null;
  all: boolean;
}

// The table shows this many ranked rows (podium included) until "Show all" is used.
export const RESULTS_PAGE_SIZE = 10;

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// A jam without an overall ranking (spec §6.4) opens on its first criterion.
export function parseResultsParams(raw: Raw, criterionIds: string[], hasOverall: boolean): ResultsParams {
  const by = first(raw.by);
  const fallback = hasOverall ? null : (criterionIds[0] ?? null);
  return {
    criterionId: criterionIds.includes(by) ? by : fallback,
    all: first(raw.all) === "1",
  };
}

// Criterion ids are cuids, so the query string needs no escaping.
export function resultsHref(slug: string, params: ResultsParams): string {
  const parts: string[] = [];
  if (params.criterionId) parts.push(`by=${params.criterionId}`);
  if (params.all) parts.push("all=1");
  return `/jams/${slug}/results${parts.length ? `?${parts.join("&")}` : ""}`;
}

function rowFor(result: SubmissionResult, criterionId: string | null): RankingRow | null {
  if (criterionId === null) {
    if (result.rank === null || result.finalScore === null) return null;
    return {
      submissionId: result.submissionId,
      rank: result.rank,
      score: result.finalScore,
      raw: result.rawAverage,
      ratings: result.totalRatings,
    };
  }
  const cs = result.criteriaScores[criterionId];
  if (!cs || cs.rank === null) return null;
  return { submissionId: result.submissionId, rank: cs.rank, score: cs.weighted, raw: cs.raw, ratings: cs.count };
}

// Unrated entries get the prior mean and a random tiebreak, so they are never on the podium
// (same rule as `podium()` in the domain), but they keep their place in the table.
export function rankingView(results: JamResults, criterionId: string | null): RankingView {
  const rows = results.competing
    .map((r) => rowFor(r, criterionId))
    .filter((r): r is RankingRow => r !== null)
    .sort((a, b) => a.rank - b.rank);
  const podium = rows.filter((r) => r.ratings > 0).slice(0, 3);
  const onPodium = new Set(podium.map((r) => r.submissionId));
  return { podium, rest: rows.filter((r) => !onPodium.has(r.submissionId)) };
}

// Score of an entry outside the ranking, for the "Not competing" list.
export function unrankedScore(result: SubmissionResult, criterionId: string | null): number | null {
  if (criterionId === null) return result.finalScore;
  return result.criteriaScores[criterionId]?.weighted ?? null;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

export function formatScore(score: number): string {
  return score.toFixed(2);
}
