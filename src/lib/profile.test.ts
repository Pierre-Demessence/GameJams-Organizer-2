import { describe, it, expect } from "vitest";
import { compareJams, jamRoleSummary, memberSince, placement, teamLine, type PlacementInput } from "@/lib/profile";

const finished: PlacementInput = {
  phase: "FINISHED",
  ranked: true,
  resultsPublic: true,
  competing: true,
  overall: { rank: 7, of: 57 },
  bestCriterion: { name: "Audio", rank: 5 },
};

describe("placement", () => {
  it("labels unranked and in-progress jams", () => {
    expect(placement({ ...finished, ranked: false })).toEqual({ label: "Showcase", highlight: false });
    expect(placement({ ...finished, ranked: false, phase: "ONGOING" })).toBeNull();
    expect(placement({ ...finished, phase: "RATING" })).toEqual({ label: "In rating", highlight: true });
    expect(placement({ ...finished, phase: "ONGOING" })).toBeNull();
    expect(placement({ ...finished, resultsPublic: false })).toBeNull();
  });

  it("shows the overall rank, or a criterion podium place when it is better news", () => {
    expect(placement(finished)).toEqual({ label: "#7 of 57", highlight: false });
    expect(placement({ ...finished, overall: { rank: 2, of: 57 }, bestCriterion: { name: "Audio", rank: 1 } })).toEqual({
      label: "#2 of 57",
      highlight: true,
    });
    expect(placement({ ...finished, bestCriterion: { name: "Presentation", rank: 2 } })).toEqual({
      label: "#2 Presentation",
      highlight: true,
    });
  });

  it("falls back to the best criterion without an overall ranking", () => {
    expect(placement({ ...finished, overall: null })).toEqual({ label: "#5 Audio", highlight: false });
    expect(placement({ ...finished, overall: null, bestCriterion: null })).toBeNull();
  });

  it("marks excluded entries", () => {
    expect(placement({ ...finished, competing: false })).toEqual({ label: "Not competing", highlight: false });
  });
});

describe("labels", () => {
  it("summarizes roles in a fixed order", () => {
    expect(jamRoleSummary(true, ["JUDGE"])).toBe("Participant · Judge");
    expect(jamRoleSummary(false, ["HOST", "ADMIN"])).toBe("Admin · Host");
    expect(jamRoleSummary(true, [])).toBe("Participant");
  });

  it("describes the team and membership date", () => {
    expect(teamLine([])).toBe("solo");
    expect(teamLine(["wren", "oto"])).toBe("with wren, oto");
    expect(memberSince(new Date("2026-03-15T00:00:00Z"))).toBe("Mar 2026");
  });

  it("orders jams live first, then most recent", () => {
    const d = (s: string) => new Date(s);
    const jams = [
      { id: "old", phase: "FINISHED" as const, startDate: d("2026-01-01") },
      { id: "new", phase: "FINISHED" as const, startDate: d("2026-06-01") },
      { id: "up", phase: "UPCOMING" as const, startDate: d("2026-12-01") },
      { id: "live", phase: "ONGOING" as const, startDate: d("2026-09-01") },
    ];
    expect(jams.sort(compareJams).map((j) => j.id)).toEqual(["live", "up", "new", "old"]);
  });
});
