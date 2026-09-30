import { describe, it, expect } from "vitest";
import { canRevealResults, podium, resultsAccess } from "@/domain/results";
import type { JamResults, SubmissionResult } from "@/domain/scoring";
import type { JamPhase } from "@/domain/jam-phase";

const revealedAt = new Date("2026-06-10T00:00:00Z");
const base = {
  ranked: true,
  phase: "FINISHED" as JamPhase,
  hideResults: false,
  resultsRevealedAt: null as Date | null,
  canPreview: false,
};

describe("resultsAccess", () => {
  it("is public once a ranked jam finishes", () => {
    expect(resultsAccess(base)).toBe("public");
  });

  it("keeps live standings from the public during RATING", () => {
    expect(resultsAccess({ ...base, phase: "RATING" })).toBe("none");
  });

  it("holds hidden results back after FINISHED until revealed", () => {
    const hidden = { ...base, hideResults: true };
    expect(resultsAccess(hidden)).toBe("none");
    expect(resultsAccess({ ...hidden, resultsRevealedAt: revealedAt })).toBe("public");
  });

  it("lets organizers preview from RATING onward", () => {
    const organizer = { ...base, canPreview: true, hideResults: true };
    expect(resultsAccess({ ...organizer, phase: "ONGOING" })).toBe("none");
    expect(resultsAccess({ ...organizer, phase: "RATING" })).toBe("preview");
    expect(resultsAccess(organizer)).toBe("preview");
  });

  it("has no results for non-ranked jams", () => {
    expect(resultsAccess({ ...base, ranked: false, canPreview: true })).toBe("none");
  });
});

describe("canRevealResults", () => {
  const hidden = { ...base, hideResults: true };

  it("reveals hidden results of a finished jam", () => {
    expect(canRevealResults(hidden).allowed).toBe(true);
  });

  it("waits for the jam to finish", () => {
    expect(canRevealResults({ ...hidden, phase: "RATING" }).allowed).toBe(false);
  });

  it("has nothing to reveal when results are already public", () => {
    expect(canRevealResults(base).allowed).toBe(false);
    expect(canRevealResults({ ...hidden, resultsRevealedAt: revealedAt }).allowed).toBe(false);
  });
});

const entry = (id: string, rank: number | null, totalRatings = 10): SubmissionResult => ({
  submissionId: id,
  competing: rank !== null,
  rank,
  finalScore: rank === null ? null : 5 - rank / 10,
  totalRatings,
  rawAverage: 4,
  criteriaScores: {},
});

describe("podium", () => {
  it("returns the top three competing entries in rank order", () => {
    const results: JamResults = {
      hasOverall: true,
      competing: [entry("d", 4), entry("b", 2), entry("a", 1), entry("c", 3)],
      notCompeting: [entry("x", null)],
    };
    expect(podium(results).map((r) => r.submissionId)).toEqual(["a", "b", "c"]);
  });
  it("skips entries nobody rated", () => {
    const results: JamResults = {
      hasOverall: true,
      competing: [entry("a", 1, 0), entry("b", 2), entry("c", 3, 0)],
      notCompeting: [],
    };
    expect(podium(results).map((r) => r.submissionId)).toEqual(["b"]);
  });
  it("is empty when the jam has no overall ranking", () => {
    expect(podium({ hasOverall: false, competing: [entry("a", null)], notCompeting: [] })).toEqual([]);
  });
});
