import { describe, it, expect, vi, beforeEach } from "vitest";

const { searchJams, checkRateLimit } = vi.hoisted(() => ({
  searchJams: vi.fn(),
  checkRateLimit: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }) }));
vi.mock("@/lib/search-queries", () => ({ searchJams }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit }));

import { searchJamsAction } from "@/app/search-actions";

beforeEach(() => {
  searchJams.mockReset().mockResolvedValue([{ slug: "a" }]);
  checkRateLimit.mockReset().mockReturnValue({ allowed: true, remaining: 1 });
});

describe("searchJamsAction", () => {
  it("rejects non-strings and oversized input without querying", async () => {
    expect(await searchJamsAction(42)).toEqual({ hits: [] });
    expect(await searchJamsAction("x".repeat(500))).toEqual({ hits: [] });
    expect(searchJams).not.toHaveBeenCalled();
  });

  it("throttles per trusted client IP", async () => {
    expect(await searchJamsAction("kite")).toEqual({ hits: [{ slug: "a" }] });
    expect(checkRateLimit).toHaveBeenCalledWith("search:203.0.113.9", 300);
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0 });
    expect(await searchJamsAction("kite")).toMatchObject({ hits: [], error: expect.stringMatching(/Too many/) });
  });
});
