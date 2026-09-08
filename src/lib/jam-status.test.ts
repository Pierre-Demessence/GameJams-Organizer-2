import { describe, it, expect } from "vitest";
import { computeJamStatus } from "@/lib/jam-status";

const base = { ranked: false, startDate: null, endDate: null, ratingEnd: null };
const day = 24 * 60 * 60 * 1000;
const now = new Date("2026-06-01T00:00:00Z");

describe("computeJamStatus", () => {
  it("returns DRAFT when dates are missing", () => {
    expect(computeJamStatus(base, now)).toBe("DRAFT");
    expect(
      computeJamStatus({ ...base, startDate: new Date(now) }, now)
    ).toBe("DRAFT");
  });

  it("returns UPCOMING before the start date", () => {
    const jam = {
      ...base,
      startDate: new Date(now.getTime() + day),
      endDate: new Date(now.getTime() + 2 * day),
    };
    expect(computeJamStatus(jam, now)).toBe("UPCOMING");
  });

  it("returns ONGOING between start and end", () => {
    const jam = {
      ...base,
      startDate: new Date(now.getTime() - day),
      endDate: new Date(now.getTime() + day),
    };
    expect(computeJamStatus(jam, now)).toBe("ONGOING");
  });

  it("returns RATING for a ranked jam between end and ratingEnd", () => {
    const jam = {
      ranked: true,
      startDate: new Date(now.getTime() - 2 * day),
      endDate: new Date(now.getTime() - day),
      ratingEnd: new Date(now.getTime() + day),
    };
    expect(computeJamStatus(jam, now)).toBe("RATING");
  });

  it("returns FINISHED for a ranked jam after ratingEnd", () => {
    const jam = {
      ranked: true,
      startDate: new Date(now.getTime() - 3 * day),
      endDate: new Date(now.getTime() - 2 * day),
      ratingEnd: new Date(now.getTime() - day),
    };
    expect(computeJamStatus(jam, now)).toBe("FINISHED");
  });

  it("returns FINISHED for a non-ranked jam after end", () => {
    const jam = {
      ...base,
      startDate: new Date(now.getTime() - 2 * day),
      endDate: new Date(now.getTime() - day),
    };
    expect(computeJamStatus(jam, now)).toBe("FINISHED");
  });
});
