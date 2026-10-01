import { describe, it, expect } from "vitest";
import { filterManageRows, moderationFlag, resultsBanner, type ManageRow } from "@/lib/manage";

const row = (over: Partial<ManageRow>): ManageRow => ({
  title: "Last Kite",
  status: "SUBMITTED",
  team: ["wren", "oto"],
  visible: true,
  rateable: true,
  competing: true,
  ...over,
});

describe("moderationFlag", () => {
  it("names the preset an entry is in", () => {
    expect(moderationFlag(row({}))).toBeNull();
    expect(moderationFlag(row({ rateable: false, competing: false }))).toBe("Disqualified");
    expect(moderationFlag(row({ competing: false }))).toBe("Not competing");
    expect(moderationFlag(row({ visible: false, competing: false }))).toBe("Hidden");
  });
});

describe("filterManageRows", () => {
  const rows = [
    row({ title: "Last Kite" }),
    row({ title: "Leaf Thing", status: "DRAFT", team: ["maple"] }),
    row({ title: "Spam", visible: false, team: ["spam4life"] }),
  ];
  const titles = (r: ManageRow[]) => r.map((x) => x.title);

  it("filters by status and flags", () => {
    expect(titles(filterManageRows(rows, "", "draft"))).toEqual(["Leaf Thing"]);
    expect(titles(filterManageRows(rows, "", "submitted"))).toEqual(["Last Kite", "Spam"]);
    expect(titles(filterManageRows(rows, "", "flagged"))).toEqual(["Spam"]);
  });

  it("matches title or member, case-insensitively", () => {
    expect(titles(filterManageRows(rows, "KITE", "all"))).toEqual(["Last Kite"]);
    expect(titles(filterManageRows(rows, "maple", "all"))).toEqual(["Leaf Thing"]);
    expect(titles(filterManageRows(rows, "  ", "all"))).toHaveLength(3);
  });
});

describe("resultsBanner", () => {
  const jam = {
    ranked: true,
    phase: "RATING" as const,
    hideResults: true,
    resultsRevealedAt: null,
    ratingEnd: new Date("2026-10-05T18:00:00Z"),
  };

  it("is absent outside rating and for showcases", () => {
    expect(resultsBanner({ ...jam, phase: "ONGOING" })).toBeNull();
    expect(resultsBanner({ ...jam, ranked: false })).toBeNull();
  });

  it("offers reveal only for held results after rating", () => {
    expect(resultsBanner(jam)).toMatchObject({ title: "Results are hidden", canReveal: false });
    expect(resultsBanner(jam)?.text).toMatch(/^Rating ends Oct 05\./);
    expect(resultsBanner({ ...jam, phase: "FINISHED" })).toMatchObject({ canReveal: true });
    expect(resultsBanner({ ...jam, phase: "FINISHED", resultsRevealedAt: new Date() })).toMatchObject({
      title: "Results are public",
      canReveal: false,
    });
    expect(resultsBanner({ ...jam, hideResults: false })?.title).toBe("Results go public when rating ends");
  });
});
