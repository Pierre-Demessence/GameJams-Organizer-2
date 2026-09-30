import { describe, it, expect } from "vitest";
import { canRate, isEligibleRater, type Rater, type RatingEligibility } from "@/domain/rating";

const leader: Rater = { isJudge: false, membership: { isLeader: true } };
const contributor: Rater = { isJudge: false, membership: { isLeader: false } };
const outsider: Rater = { isJudge: false, membership: null };
const judge: Rater = { isJudge: true, membership: null };

const modes: RatingEligibility[] = [
  "SUBMITTERS_ONLY",
  "SUBMITTERS_AND_CONTRIBUTORS",
  "JUDGES_ONLY",
  "EVERYONE",
];
const eligibleModes = (rater: Rater) => modes.filter((m) => isEligibleRater(m, rater));

describe("isEligibleRater", () => {
  it("lets judges rate under every eligibility mode", () => {
    expect(eligibleModes(judge)).toEqual(modes);
  });

  it("lets team leaders rate in every submitter mode", () => {
    expect(eligibleModes(leader)).toEqual([
      "SUBMITTERS_ONLY",
      "SUBMITTERS_AND_CONTRIBUTORS",
      "EVERYONE",
    ]);
  });

  it("keeps contributors out of leader-only rating", () => {
    expect(eligibleModes(contributor)).toEqual(["SUBMITTERS_AND_CONTRIBUTORS", "EVERYONE"]);
  });

  it("lets users without a finalized submission rate only when everyone can", () => {
    expect(eligibleModes(outsider)).toEqual(["EVERYONE"]);
  });
});

describe("canRate", () => {
  const base = {
    phase: "RATING" as const,
    ranked: true,
    eligibility: "SUBMITTERS_AND_CONTRIBUTORS" as const,
    rater: contributor,
    isOwnSubmission: false,
    submission: { status: "SUBMITTED" as const, rateable: true },
  };

  it("allows an eligible rater on a finalized, rateable entry during RATING", () => {
    expect(canRate(base).allowed).toBe(true);
  });

  it("only accepts ratings during the rating period of ranked jams", () => {
    expect(canRate({ ...base, ranked: false }).allowed).toBe(false);
    expect(canRate({ ...base, phase: "ONGOING" }).allowed).toBe(false);
    expect(canRate({ ...base, phase: "FINISHED" }).allowed).toBe(false);
  });

  it("rejects drafts and rating-disabled entries", () => {
    expect(
      canRate({ ...base, submission: { status: "DRAFT", rateable: true } }).allowed
    ).toBe(false);
    expect(
      canRate({ ...base, submission: { status: "SUBMITTED", rateable: false } }).allowed
    ).toBe(false);
  });

  it("forbids rating your own submission, even as a judge", () => {
    expect(canRate({ ...base, rater: judge, isOwnSubmission: true })).toEqual({
      allowed: false,
      reason: "You cannot rate your own submission",
    });
  });

  it("rejects ineligible raters", () => {
    expect(canRate({ ...base, rater: outsider })).toEqual({
      allowed: false,
      reason: "You are not eligible to rate in this jam",
    });
  });
});
