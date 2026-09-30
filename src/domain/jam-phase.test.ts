import { describe, it, expect } from "vitest";
import {
  canPublish,
  jamPhase,
  validateJamDates,
  type JamPhaseInput,
} from "@/domain/jam-phase";

const hour = 60 * 60 * 1000;
const start = new Date("2026-06-01T00:00:00Z");
const end = new Date(start.getTime() + 48 * hour);
const ratingEnd = new Date(end.getTime() + 72 * hour);
const published = new Date(start.getTime() - 24 * hour);

const ranked: JamPhaseInput = {
  publishedAt: published,
  startDate: start,
  endDate: end,
  ratingEnd,
  ranked: true,
};
const unranked: JamPhaseInput = { ...ranked, ranked: false, ratingEnd: null };

const at = (ms: number) => new Date(ms);

describe("jamPhase", () => {
  it("stays DRAFT while unpublished, whatever the dates", () => {
    const draft = { ...ranked, publishedAt: null };
    expect(jamPhase(draft, at(start.getTime() - hour))).toBe("DRAFT");
    expect(jamPhase(draft, at(start.getTime() + hour))).toBe("DRAFT");
    expect(jamPhase(draft, at(ratingEnd.getTime() + hour))).toBe("DRAFT");
  });

  it("stays DRAFT when published without both dates", () => {
    expect(jamPhase({ ...ranked, startDate: null }, start)).toBe("DRAFT");
    expect(jamPhase({ ...ranked, endDate: null }, start)).toBe("DRAFT");
  });

  it("is UPCOMING before the start date", () => {
    expect(jamPhase(ranked, at(start.getTime() - 1))).toBe("UPCOMING");
  });

  it("becomes ONGOING exactly at the start date", () => {
    expect(jamPhase(ranked, start)).toBe("ONGOING");
    expect(jamPhase(ranked, at(end.getTime() - 1))).toBe("ONGOING");
  });

  it("becomes RATING exactly at the end date for ranked jams", () => {
    expect(jamPhase(ranked, end)).toBe("RATING");
    expect(jamPhase(ranked, at(ratingEnd.getTime() - 1))).toBe("RATING");
  });

  it("becomes FINISHED exactly at the rating-end date for ranked jams", () => {
    expect(jamPhase(ranked, ratingEnd)).toBe("FINISHED");
  });

  it("goes straight from ONGOING to FINISHED for non-ranked jams", () => {
    expect(jamPhase(unranked, at(end.getTime() - 1))).toBe("ONGOING");
    expect(jamPhase(unranked, end)).toBe("FINISHED");
  });

  it("ignores ratingEnd on non-ranked jams", () => {
    const withRatingEnd = { ...unranked, ratingEnd };
    expect(jamPhase(withRatingEnd, at(end.getTime() + hour))).toBe("FINISHED");
  });
});

describe("validateJamDates", () => {
  const complete = { startDate: start, endDate: end, ratingEnd, ranked: true };

  it("accepts ordered dates", () => {
    expect(validateJamDates(complete, { requireComplete: true }).allowed).toBe(true);
  });

  it("lets drafts keep partial dates", () => {
    const partial = { startDate: start, endDate: null, ratingEnd: null, ranked: true };
    expect(validateJamDates(partial, { requireComplete: false }).allowed).toBe(true);
    expect(validateJamDates(partial, { requireComplete: true }).allowed).toBe(false);
  });

  it("requires a rating end for complete ranked schedules", () => {
    const noRatingEnd = { ...complete, ratingEnd: null };
    expect(validateJamDates(noRatingEnd, { requireComplete: true })).toEqual({
      allowed: false,
      reason: "Rating end date is required for ranked jams",
    });
    expect(
      validateJamDates({ ...noRatingEnd, ranked: false }, { requireComplete: true }).allowed
    ).toBe(true);
  });

  it("rejects equal or reversed start and end", () => {
    const same = { ...complete, endDate: start };
    expect(validateJamDates(same, { requireComplete: false }).allowed).toBe(false);
  });

  it("rejects a rating end that does not follow the end date", () => {
    const early = { ...complete, ratingEnd: end };
    expect(validateJamDates(early, { requireComplete: false }).allowed).toBe(false);
    const orphan = { ...complete, endDate: null };
    expect(validateJamDates(orphan, { requireComplete: false }).allowed).toBe(false);
  });
});

describe("canPublish", () => {
  const rated = (over: Partial<{ weight: number; isPrimary: boolean }> = {}) => ({
    source: "RATED" as const,
    weight: 1,
    isPrimary: false,
    ...over,
  });
  const draft = { ...ranked, publishedAt: null, criteria: [rated()] };

  it("publishes a draft with valid dates and a criterion", () => {
    expect(canPublish(draft).allowed).toBe(true);
  });

  it("refuses to publish twice", () => {
    expect(canPublish({ ...draft, publishedAt: published }).allowed).toBe(false);
  });

  it("requires a complete schedule", () => {
    expect(canPublish({ ...draft, endDate: null }).allowed).toBe(false);
  });

  it("requires at least one criterion for ranked jams only", () => {
    expect(canPublish({ ...draft, criteria: [] }).allowed).toBe(false);
    expect(
      canPublish({ ...draft, ranked: false, ratingEnd: null, criteria: [] }).allowed
    ).toBe(true);
  });

  it("needs a primary or a weighted rated criterion to form an overall", () => {
    const allZero = [rated({ weight: 0 }), rated({ weight: 0 })];
    expect(canPublish({ ...draft, criteria: allZero }).allowed).toBe(false);
    const withPrimary = [rated({ weight: 0, isPrimary: true }), rated({ weight: 0 })];
    expect(canPublish({ ...draft, criteria: withPrimary }).allowed).toBe(true);
    expect(canPublish({ ...draft, criteria: [rated({ weight: 0 })] }).allowed).toBe(true);
  });

  it("accepts an all-jury jam without a primary (no overall ranking)", () => {
    const jury = [
      { source: "JURY" as const, weight: 1, isPrimary: false },
      { source: "JURY" as const, weight: 1, isPrimary: false },
    ];
    expect(canPublish({ ...draft, criteria: jury }).allowed).toBe(true);
  });
});
