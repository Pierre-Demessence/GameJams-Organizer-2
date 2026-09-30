import { describe, it, expect } from "vitest";
import { entriesHref, nextToRate, parseEntriesParams } from "@/lib/jam-entries";

const t = (d: number) => new Date(Date.UTC(2026, 9, d));

describe("parseEntriesParams", () => {
  it("defaults to fewest ratings first while rating, newest otherwise", () => {
    expect(parseEntriesParams({}, "RATING")).toEqual({ platforms: [], hideRated: false, sort: "fewest" });
    expect(parseEntriesParams({}, "FINISHED").sort).toBe("newest");
  });
  it("reads a comma list of known platforms and drops the rest", () => {
    expect(parseEntriesParams({ platforms: "web,windows,atari,web" }, "RATING").platforms).toEqual(["WEB", "WINDOWS"]);
  });
  it("only honours hideRated and fewest during rating", () => {
    expect(parseEntriesParams({ hideRated: "1", sort: "fewest" }, "FINISHED")).toMatchObject({ hideRated: false, sort: "newest" });
    expect(parseEntriesParams({ hideRated: "1", sort: "title" }, "RATING")).toMatchObject({ hideRated: true, sort: "title" });
  });
});

describe("entriesHref", () => {
  it("serialises only non-defaults", () => {
    const p = parseEntriesParams({}, "RATING");
    expect(entriesHref("jam", "RATING", p)).toBe("/jams/jam/submissions");
    expect(entriesHref("jam", "RATING", p, { platforms: ["WEB", "MAC"], hideRated: true })).toBe(
      "/jams/jam/submissions?platforms=web,mac&hideRated=1"
    );
  });
  it("keeps a sort that differs from the phase default", () => {
    const rating = parseEntriesParams({}, "RATING");
    expect(entriesHref("jam", "RATING", rating, { sort: "newest" })).toBe("/jams/jam/submissions?sort=newest");
    const finished = parseEntriesParams({}, "FINISHED");
    expect(entriesHref("jam", "FINISHED", finished, { sort: "newest" })).toBe("/jams/jam/submissions");
    expect(entriesHref("jam", "FINISHED", finished, { sort: "title" })).toBe("/jams/jam/submissions?sort=title");
  });
});

describe("nextToRate", () => {
  const e = (id: string, raters: number, day: number, extra: Partial<{ eligible: boolean; ratedByViewer: boolean }> = {}) => ({
    id, raters, createdAt: t(day), eligible: true, ratedByViewer: false, ...extra,
  });
  it("picks the least-rated eligible entry the viewer has not rated, oldest first on ties", () => {
    expect(nextToRate([e("a", 3, 1), e("b", 1, 3), e("c", 1, 2), e("d", 0, 1, { ratedByViewer: true })])).toBe("c");
  });
  it("skips ineligible entries (own team, not rateable)", () => {
    expect(nextToRate([e("a", 0, 1, { eligible: false }), e("b", 5, 1)])).toBe("b");
  });
  it("returns null when nothing is left", () => {
    expect(nextToRate([e("a", 0, 1, { ratedByViewer: true }), e("b", 0, 1, { eligible: false })])).toBeNull();
    expect(nextToRate([])).toBeNull();
  });
});
