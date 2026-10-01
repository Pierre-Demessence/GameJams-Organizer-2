import { describe, it, expect } from "vitest";
import { normalizeQuery, rankSearchHits, type SearchHit } from "@/lib/search";

const hit = (name: string, phase: SearchHit["phase"], shortDesc = "", day = 1): SearchHit => ({
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  shortDesc,
  phase,
  publishedAt: new Date(Date.UTC(2026, 0, day)),
});

describe("normalizeQuery", () => {
  it("trims, collapses spaces and caps the length", () => {
    expect(normalizeQuery("  pixel   jam ")).toBe("pixel jam");
    expect(normalizeQuery("x".repeat(150))).toHaveLength(100);
  });
});

describe("rankSearchHits", () => {
  it("prefers name matches, then live jams, then the newest", () => {
    const hits = [
      hit("Spooky Week", "ONGOING", "pixel art only"),
      hit("Mini Pixel Jam", "FINISHED"),
      hit("Pixel Pumpkin", "UPCOMING"),
      hit("Pixel Party", "ONGOING"),
      hit("Old Pixel Jam", "FINISHED", "", 1),
      hit("New Pixel Jam", "FINISHED", "", 9),
    ];
    expect(rankSearchHits(hits, " PIXEL ").map((h) => h.name)).toEqual([
      "Pixel Party",
      "Pixel Pumpkin",
      "New Pixel Jam",
      "Mini Pixel Jam",
      "Old Pixel Jam",
      "Spooky Week",
    ]);
  });

  it("puts an exact name first and respects the limit", () => {
    const hits = [hit("Pixel Jam Extra", "ONGOING"), hit("Pixel Jam", "FINISHED")];
    expect(rankSearchHits(hits, "pixel jam", 1).map((h) => h.name)).toEqual(["Pixel Jam"]);
  });
});
