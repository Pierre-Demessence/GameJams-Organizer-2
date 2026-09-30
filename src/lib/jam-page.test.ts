import { describe, it, expect } from "vitest";
import { entryPanelState, jamTimeline } from "@/lib/jam-page";

const DAY = 86_400_000;
const base = new Date("2026-10-01T00:00:00Z");
const at = (d: number) => new Date(base.getTime() + d * DAY);
const ranked = {
  publishedAt: at(-10), startDate: at(-2), endDate: at(2), ratingEnd: at(12), ranked: true,
};

describe("jamTimeline", () => {
  it("has three segments for a ranked jam, the jam segment current while live", () => {
    const t = jamTimeline(ranked, "ONGOING", base);
    expect(t.map((s) => [s.key, s.state])).toEqual([
      ["upcoming", "past"], ["jam", "current"], ["rating", "future"],
    ]);
    expect(t.reduce((n, s) => n + s.widthPct, 0)).toBe(100);
    expect(t[1].progress).toBe(50);
    expect(t[1].dates).toBe("Sep 29 → Oct 03");
    expect(t[2].dates).toBe("Oct 03 → Oct 13");
  });
  it("has two segments for a showcase jam", () => {
    const t = jamTimeline({ ...ranked, ranked: false, ratingEnd: null }, "UPCOMING", base);
    expect(t.map((s) => s.key)).toEqual(["upcoming", "jam"]);
    expect(t[0].state).toBe("current");
    expect(t.reduce((n, s) => n + s.widthPct, 0)).toBe(100);
  });
  it("marks everything past when finished", () => {
    expect(jamTimeline(ranked, "FINISHED", base).every((s) => s.state === "past")).toBe(true);
  });
  it("leaves dates empty when they are missing (draft)", () => {
    const t = jamTimeline({ ...ranked, publishedAt: null, startDate: null, endDate: null, ratingEnd: null }, "DRAFT", base);
    expect(t.every((s) => s.state === "future" && s.dates === "")).toBe(true);
  });
});

describe("entryPanelState", () => {
  const none = { signedIn: true, hasJoined: false, submission: null };
  it("asks signed-out visitors to sign in, saying whether they could join", () => {
    expect(entryPanelState({ ...none, signedIn: false, phase: "UPCOMING" })).toEqual({ kind: "signed-out", canJoin: true });
    expect(entryPanelState({ ...none, signedIn: false, phase: "FINISHED" })).toEqual({ kind: "signed-out", canJoin: false });
  });
  it("offers joining while the jam is upcoming or live", () => {
    expect(entryPanelState({ ...none, phase: "ONGOING" })).toEqual({ kind: "can-join" });
  });
  it("lets joined users create a submission only while live", () => {
    expect(entryPanelState({ ...none, hasJoined: true, phase: "ONGOING" })).toEqual({ kind: "joined", canCreate: true });
    expect(entryPanelState({ ...none, hasJoined: true, phase: "UPCOMING" })).toEqual({ kind: "joined", canCreate: false });
  });
  it("points to the existing entry", () => {
    expect(
      entryPanelState({ ...none, hasJoined: true, phase: "RATING", submission: { id: "s1", status: "SUBMITTED" } })
    ).toEqual({ kind: "has-entry", submissionId: "s1", status: "SUBMITTED" });
  });
  it("is closed for outsiders once submissions close", () => {
    expect(entryPanelState({ ...none, phase: "RATING" })).toEqual({ kind: "closed" });
  });
});
