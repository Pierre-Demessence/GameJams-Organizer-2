import { describe, it, expect } from "vitest";
import { canRevealResults, resultsAccess } from "@/domain/results";
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
