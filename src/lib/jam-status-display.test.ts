import { describe, it, expect } from "vitest";
import {
  TONE_BG,
  TONE_PILL,
  TONE_TEXT,
  formatCountdown,
  formatDuration,
  formatTimeLeftShort,
  jamStatus,
  nextDeadline,
  phaseProgress,
} from "@/lib/jam-status-display";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const base = new Date("2026-10-01T00:00:00Z");
const at = (offsetMs: number) => new Date(base.getTime() + offsetMs);

const jam = {
  publishedAt: at(-10 * DAY),
  startDate: at(-2 * DAY),
  endDate: at(2 * DAY),
  ratingEnd: at(6 * DAY),
  ranked: true,
};

describe("jamStatus", () => {
  it("shows ONGOING as Live", () => {
    expect(jamStatus("ONGOING")).toEqual({ label: "Live", tone: "live" });
  });
  it("maps every other phase", () => {
    expect(jamStatus("DRAFT").label).toBe("Draft");
    expect(jamStatus("UPCOMING").tone).toBe("upcoming");
    expect(jamStatus("RATING").tone).toBe("rating");
    expect(jamStatus("FINISHED").label).toBe("Finished");
  });
  it("has classes for every tone", () => {
    for (const map of [TONE_TEXT, TONE_BG, TONE_PILL]) {
      expect(Object.keys(map).sort()).toEqual(["draft", "finished", "live", "rating", "upcoming"]);
    }
    expect(TONE_TEXT.live).toBe("text-live");
  });
});

describe("nextDeadline", () => {
  it("counts to the start while upcoming", () => {
    expect(nextDeadline(jam, "UPCOMING")).toEqual({ label: "Starts", at: jam.startDate });
  });
  it("counts to the end while live", () => {
    expect(nextDeadline(jam, "ONGOING")).toEqual({ label: "Submissions close", at: jam.endDate });
  });
  it("counts to rating end while rating", () => {
    expect(nextDeadline(jam, "RATING")).toEqual({ label: "Rating closes", at: jam.ratingEnd });
  });
  it("has no deadline when finished, draft, or missing dates", () => {
    expect(nextDeadline(jam, "FINISHED")).toBeNull();
    expect(nextDeadline(jam, "DRAFT")).toBeNull();
    expect(nextDeadline({ ...jam, ratingEnd: null }, "RATING")).toBeNull();
  });
});

describe("phaseProgress", () => {
  it("is halfway through a live jam at its midpoint", () => {
    expect(phaseProgress(jam, "ONGOING", base)).toBe(50);
  });
  it("tracks the rating window separately", () => {
    expect(phaseProgress(jam, "RATING", at(4 * DAY))).toBe(50);
  });
  it("is 0 before start and 100 when finished", () => {
    expect(phaseProgress(jam, "UPCOMING", base)).toBe(0);
    expect(phaseProgress(jam, "FINISHED", base)).toBe(100);
  });
  it("clamps and survives a zero-length window", () => {
    const flat = { ...jam, startDate: base, endDate: base };
    expect(phaseProgress(flat, "ONGOING", base)).toBe(100);
    expect(phaseProgress(jam, "ONGOING", at(10 * DAY))).toBe(100);
  });
});

describe("formatCountdown", () => {
  it("shows days when at least one day is left", () => {
    expect(formatCountdown(2 * DAY + 6 * HOUR + 14 * 60_000 + 9_000)).toBe("2d 06:14:09");
    expect(formatCountdown(DAY)).toBe("1d 00:00:00");
  });
  it("drops the day part under a day", () => {
    expect(formatCountdown(18 * HOUR + 2 * 60_000 + 51_000)).toBe("18:02:51");
  });
  it("never goes negative", () => {
    expect(formatCountdown(-5_000)).toBe("00:00:00");
    expect(formatCountdown(Number.NaN)).toBe("00:00:00");
  });
});

describe("formatTimeLeftShort", () => {
  it("uses days and hours, or hours and minutes", () => {
    expect(formatTimeLeftShort(9 * DAY + 3 * HOUR)).toBe("9d 03h");
    expect(formatTimeLeftShort(5 * HOUR + 12 * 60_000)).toBe("05h 12m");
    expect(formatTimeLeftShort(-1)).toBe("00h 00m");
  });
});

describe("formatDuration", () => {
  it("uses hours up to 72 and days beyond", () => {
    expect(formatDuration(base, at(48 * HOUR))).toBe("48 hours");
    expect(formatDuration(base, at(72 * HOUR))).toBe("72 hours");
    expect(formatDuration(base, at(7 * DAY))).toBe("7 days");
    expect(formatDuration(base, at(1 * HOUR))).toBe("1 hour");
  });
  it("rounds partial days and never goes negative", () => {
    expect(formatDuration(base, at(3.6 * DAY))).toBe("4 days");
    expect(formatDuration(base, base)).toBe("0 hours");
    expect(formatDuration(at(5 * HOUR), base)).toBe("0 hours");
  });
});
