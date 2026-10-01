import { describe, it, expect } from "vitest";
import type { JamResults, SubmissionResult } from "@/domain/scoring";
import {
  formatScore,
  ordinal,
  parseResultsParams,
  rankingView,
  resultsHref,
  unrankedScore,
} from "@/lib/results-view";

function result(
  id: string,
  rank: number | null,
  finalScore: number | null,
  totalRatings: number,
  fun: { weighted: number; raw: number; count: number; rank: number | null }
): SubmissionResult {
  return {
    submissionId: id,
    competing: rank !== null,
    rank,
    finalScore,
    totalRatings,
    rawAverage: fun.raw,
    criteriaScores: { fun },
  };
}

const results: JamResults = {
  hasOverall: true,
  competing: [
    result("a", 1, 4.5, 10, { weighted: 4.1, raw: 4.6, count: 10, rank: 2 }),
    result("unrated", 2, 3.9, 0, { weighted: 3.9, raw: 0, count: 0, rank: 4 }),
    result("b", 3, 3.8, 6, { weighted: 4.3, raw: 4.4, count: 6, rank: 1 }),
    result("c", 4, 3.5, 4, { weighted: 3.95, raw: 3.5, count: 4, rank: 3 }),
    result("d", 5, 3.1, 2, { weighted: 3.1, raw: 3.0, count: 2, rank: 5 }),
  ],
  notCompeting: [],
};

describe("rankingView", () => {
  it("keeps unrated entries off the podium but in the table", () => {
    const view = rankingView(results, null);
    expect(view.podium.map((r) => [r.submissionId, r.rank])).toEqual([
      ["a", 1],
      ["b", 3],
      ["c", 4],
    ]);
    expect(view.rest.map((r) => r.submissionId)).toEqual(["unrated", "d"]);
    expect(view.podium[0]).toMatchObject({ score: 4.5, raw: 4.6, ratings: 10 });
  });

  it("ranks by one criterion's weighted score", () => {
    const view = rankingView(results, "fun");
    expect(view.podium.map((r) => r.submissionId)).toEqual(["b", "a", "c"]);
    expect(view.podium[0]).toMatchObject({ rank: 1, score: 4.3, raw: 4.4, ratings: 6 });
    expect(view.rest.map((r) => r.submissionId)).toEqual(["unrated", "d"]);
  });

  it("has no overall rows when the jam has no overall ranking", () => {
    const none: JamResults = {
      hasOverall: false,
      competing: [result("a", null, null, 3, { weighted: 4, raw: 4, count: 3, rank: 1 })],
      notCompeting: [],
    };
    expect(rankingView(none, null)).toEqual({ podium: [], rest: [] });
    expect(rankingView(none, "fun").podium).toHaveLength(1);
  });
});

describe("parseResultsParams / resultsHref", () => {
  const ids = ["c1", "c2"];

  it("defaults to the overall, or to the first criterion without one", () => {
    expect(parseResultsParams({}, ids, true)).toEqual({ criterionId: null, all: false });
    expect(parseResultsParams({}, ids, false)).toEqual({ criterionId: "c1", all: false });
  });

  it("ignores unknown criteria", () => {
    expect(parseResultsParams({ by: "nope", all: "1" }, ids, true)).toEqual({ criterionId: null, all: true });
    expect(parseResultsParams({ by: ["c2", "c1"] }, ids, true).criterionId).toBe("c2");
  });

  it("builds canonical links", () => {
    expect(resultsHref("jam", { criterionId: null, all: false })).toBe("/jams/jam/results");
    expect(resultsHref("jam", { criterionId: "c2", all: true })).toBe("/jams/jam/results?by=c2&all=1");
  });
});

describe("formatting", () => {
  it("formats ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "103rd",
    ]);
  });

  it("formats scores and unranked scores", () => {
    expect(formatScore(4.5)).toBe("4.50");
    const r = result("x", null, 3.25, 2, { weighted: 3.4, raw: 3.5, count: 2, rank: null });
    expect(unrankedScore(r, null)).toBe(3.25);
    expect(unrankedScore(r, "fun")).toBe(3.4);
    expect(unrankedScore(r, "missing")).toBeNull();
  });
});
