import { describe, it, expect } from "vitest";
import {
  rankSubmissions,
  type ScoringCriterion,
  type ScoringRating,
  type ScoringSubmission,
} from "@/domain/scoring";

const criterion = (over: Partial<ScoringCriterion> = {}): ScoringCriterion => ({
  id: "c1",
  weight: 1,
  source: "RATED",
  isPrimary: false,
  ...over,
});
const sub = (id: string, competing = true): ScoringSubmission => ({ id, competing });
const rate = (submissionId: string, criterionId: string, ...scores: number[]): ScoringRating[] =>
  scores.map((score) => ({ submissionId, criterionId, score }));

const order = (results: { submissionId: string }[]) => results.map((r) => r.submissionId);

describe("rankSubmissions", () => {
  it("ranks higher-scored submissions first (a lone criterion is primary)", () => {
    const { competing, hasOverall } = rankSubmissions({
      criteria: [criterion()],
      submissions: [sub("sB"), sub("sA")],
      ratings: [...rate("sA", "c1", 5, 5, 5), ...rate("sB", "c1", 2, 2)],
    });
    expect(hasOverall).toBe(true);
    expect(competing.map((r) => [r.submissionId, r.rank])).toEqual([
      ["sA", 1],
      ["sB", 2],
    ]);
  });

  it("damps a single perfect rating with the Bayesian prior", () => {
    const { competing } = rankSubmissions({
      criteria: [criterion()],
      submissions: [sub("lucky"), sub("solid"), sub("other")],
      ratings: [
        ...rate("lucky", "c1", 5),
        ...rate("solid", "c1", 5, 5, 5, 5, 4, 5, 5, 4),
        ...rate("other", "c1", 2, 2, 3),
      ],
    });
    expect(order(competing)[0]).toBe("solid");
  });

  it("uses the primary criterion for the overall, overriding the weighted average", () => {
    const { competing } = rankSubmissions({
      criteria: [criterion({ id: "c1", weight: 100 }), criterion({ id: "c2", isPrimary: true })],
      submissions: [sub("sA"), sub("sB")],
      ratings: [
        ...rate("sA", "c1", 1, 1, 1),
        ...rate("sB", "c1", 5, 5, 5),
        ...rate("sA", "c2", 5, 5, 5),
        ...rate("sB", "c2", 1, 1, 1),
      ],
    });
    expect(order(competing)).toEqual(["sA", "sB"]);
  });

  it("averages weighted scores when no primary is set", () => {
    const { competing } = rankSubmissions({
      criteria: [criterion({ id: "c1", weight: 3 }), criterion({ id: "c2", weight: 1 })],
      submissions: [sub("sA"), sub("sB")],
      ratings: [
        ...rate("sA", "c1", 5, 5),
        ...rate("sB", "c1", 2, 2),
        ...rate("sA", "c2", 1, 1),
        ...rate("sB", "c2", 5, 5),
      ],
    });
    expect(order(competing)).toEqual(["sA", "sB"]);
  });

  it("ranks weight-0 criteria on their own without touching the overall", () => {
    const { competing } = rankSubmissions({
      criteria: [criterion({ id: "fun" }), criterion({ id: "art", weight: 0 })],
      submissions: [sub("sA"), sub("sB")],
      ratings: [
        ...rate("sA", "fun", 5, 5),
        ...rate("sB", "fun", 2, 2),
        ...rate("sA", "art", 1, 1),
        ...rate("sB", "art", 5, 5),
      ],
    });
    const byId = Object.fromEntries(competing.map((r) => [r.submissionId, r]));
    expect(order(competing)).toEqual(["sA", "sB"]);
    expect(byId.sB.criteriaScores.art.rank).toBe(1);
    expect(byId.sA.criteriaScores.art.rank).toBe(2);
  });

  it("has no overall ranking without a primary or a weighted criterion", () => {
    const { hasOverall, competing } = rankSubmissions({
      criteria: [criterion({ id: "c1", weight: 0 }), criterion({ id: "c2", weight: 0 })],
      submissions: [sub("sA"), sub("sB")],
      ratings: [...rate("sA", "c1", 5), ...rate("sB", "c1", 1)],
    });
    expect(hasOverall).toBe(false);
    expect(competing.every((r) => r.rank === null && r.finalScore === null)).toBe(true);
    expect(competing.find((r) => r.submissionId === "sA")!.criteriaScores.c1.rank).toBe(1);
  });

  it("gives each criterion its own ranking among competing entries", () => {
    const { competing } = rankSubmissions({
      criteria: [criterion({ id: "c1", isPrimary: true }), criterion({ id: "c2" })],
      submissions: [sub("sA"), sub("sB")],
      ratings: [
        ...rate("sA", "c1", 5),
        ...rate("sB", "c1", 1),
        ...rate("sA", "c2", 1),
        ...rate("sB", "c2", 5),
      ],
    });
    const byId = Object.fromEntries(competing.map((r) => [r.submissionId, r]));
    expect(byId.sA.criteriaScores.c1.rank).toBe(1);
    expect(byId.sB.criteriaScores.c2.rank).toBe(1);
  });

  it("breaks score ties by rating count, then raw average", () => {
    const { competing } = rankSubmissions({
      criteria: [criterion()],
      submissions: [sub("few"), sub("many")],
      ratings: [...rate("few", "c1", 4), ...rate("many", "c1", 4, 4)],
    });
    expect(order(competing)).toEqual(["many", "few"]);
  });

  it("breaks full ties deterministically", () => {
    const input = {
      criteria: [criterion()],
      submissions: [sub("x"), sub("y")],
      ratings: [...rate("x", "c1", 3), ...rate("y", "c1", 3)],
    };
    const first = order(rankSubmissions(input).competing);
    const reversed = order(
      rankSubmissions({ ...input, submissions: [...input.submissions].reverse() }).competing
    );
    expect(reversed).toEqual(first);
  });

  it("lists rated non-competing entries apart, unranked", () => {
    const { competing, notCompeting } = rankSubmissions({
      criteria: [criterion()],
      submissions: [sub("sA"), sub("rated-dq", false), sub("unrated-dq", false)],
      ratings: [...rate("sA", "c1", 4), ...rate("rated-dq", "c1", 5)],
    });
    expect(order(competing)).toEqual(["sA"]);
    expect(order(notCompeting)).toEqual(["rated-dq"]);
    expect(notCompeting[0].rank).toBeNull();
    expect(notCompeting[0].criteriaScores.c1.rank).toBeNull();
  });

  it("ignores JURY criteria when scoring", () => {
    const { competing } = rankSubmissions({
      criteria: [criterion({ id: "c1" }), criterion({ id: "jury", source: "JURY" })],
      submissions: [sub("sA")],
      ratings: rate("sA", "c1", 4),
    });
    expect(Object.keys(competing[0].criteriaScores)).toEqual(["c1"]);
  });

  it("returns empty rankings when nothing was submitted", () => {
    expect(rankSubmissions({ criteria: [criterion()], submissions: [], ratings: [] })).toEqual({
      hasOverall: true,
      competing: [],
      notCompeting: [],
    });
  });
});
