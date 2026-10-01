import { describe, it, expect } from "vitest";
import { publishChecklist, scheduleSummary, slugify, type ChecklistInput } from "@/lib/jam-form";

const d = (s: string) => new Date(`${s}T18:00:00Z`);

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Pixel Pumpkin Jam 2026!")).toBe("pixel-pumpkin-jam-2026");
    expect(slugify("  Café — Été  ")).toBe("cafe-ete");
    expect(slugify("a".repeat(70)).length).toBe(60);
  });
});

describe("scheduleSummary", () => {
  it("draws jam and rating to scale", () => {
    expect(scheduleSummary({ startDate: d("2026-10-09"), endDate: d("2026-10-12"), ratingEnd: d("2026-10-19"), ranked: true })).toEqual({
      jamPct: 30,
      text: "72 hours of jamming, then 7 days of rating · Oct 09 → Oct 19",
    });
  });

  it("shows the jam alone for showcases or a missing rating end", () => {
    expect(scheduleSummary({ startDate: d("2026-10-09"), endDate: d("2026-10-12"), ratingEnd: null, ranked: true })).toEqual({
      jamPct: 100,
      text: "72 hours of jamming · Oct 09 → Oct 12",
    });
  });

  it("is empty without a valid window", () => {
    expect(scheduleSummary({ startDate: null, endDate: d("2026-10-12"), ratingEnd: null, ranked: false })).toBeNull();
    expect(scheduleSummary({ startDate: d("2026-10-12"), endDate: d("2026-10-09"), ratingEnd: null, ranked: false })).toBeNull();
  });
});

describe("publishChecklist", () => {
  const ready: ChecklistInput = {
    name: "Pixel Pumpkin",
    slug: "pixel-pumpkin",
    shortDesc: "Spooky",
    fullDesc: "Rules",
    coverUrl: "",
    theme: "",
    startDate: d("2026-10-09"),
    endDate: d("2026-10-12"),
    ratingEnd: d("2026-10-19"),
    ranked: true,
    criteria: [{ source: "RATED", weight: 1, isPrimary: false }],
    customFieldCount: 0,
  };

  it("is ready when required items are done, whatever the recommendations", () => {
    const { checks, ready: ok } = publishChecklist(ready);
    expect(ok).toBe(true);
    expect(checks.map((c) => [c.key, c.state])).toEqual([
      ["basics", "done"],
      ["dates", "done"],
      ["criteria", "done"],
      ["theme", "optional"],
      ["questions", "optional"],
      ["cover", "optional"],
    ]);
  });

  it("blocks on missing basics, bad dates or criteria, with the reason", () => {
    const res = publishChecklist({ ...ready, slug: "X", ratingEnd: null, criteria: [] });
    expect(res.ready).toBe(false);
    expect(res.checks.find((c) => c.key === "dates")).toMatchObject({
      state: "todo",
      hint: "Rating end date is required for ranked jams",
    });
    expect(res.checks.find((c) => c.key === "basics")?.state).toBe("todo");
    expect(res.checks.find((c) => c.key === "criteria")?.state).toBe("todo");
  });

  it("has no criteria item for showcases", () => {
    const res = publishChecklist({ ...ready, ranked: false, ratingEnd: null, criteria: [] });
    expect(res.ready).toBe(true);
    expect(res.checks.some((c) => c.key === "criteria")).toBe(false);
  });
});
