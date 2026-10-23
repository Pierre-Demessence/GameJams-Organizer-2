import { describe, it, expect } from "vitest";
import { checkRateLimit, purgeExpiredRateLimits } from "@/lib/rate-limit";
import { db } from "@/lib/db";

const MINUTE_MS = 60_000;

async function ageWindow(key: string, minutes: number): Promise<void> {
  const row = await db.rateLimit.findUniqueOrThrow({ where: { key } });
  await db.rateLimit.update({
    where: { key },
    data: { windowStart: new Date(row.windowStart.getTime() - minutes * MINUTE_MS) },
  });
}

describe("checkRateLimit", () => {
  it("allows up to the default budget of 10, then denies", async () => {
    const results = [];
    for (let i = 0; i < 11; i++) results.push(await checkRateLimit("k"));

    expect(results.slice(0, 10).every((r) => r.allowed)).toBe(true);
    expect(results[0].remaining).toBe(9);
    expect(results[9].remaining).toBe(0);
    expect(results[10]).toEqual({ allowed: false, remaining: 0 });
  });

  it("honors a custom max", async () => {
    expect((await checkRateLimit("k", 2)).allowed).toBe(true);
    expect((await checkRateLimit("k", 2)).allowed).toBe(true);
    expect((await checkRateLimit("k", 2)).allowed).toBe(false);
  });

  it("tracks keys independently", async () => {
    await checkRateLimit("a", 1);
    expect((await checkRateLimit("a", 1)).allowed).toBe(false);

    expect((await checkRateLimit("b", 1)).allowed).toBe(true);
  });

  it("keeps counting inside the window", async () => {
    await checkRateLimit("k", 1);
    await ageWindow("k", 14);

    expect((await checkRateLimit("k", 1)).allowed).toBe(false);
  });

  it("starts a new window once the old one has passed", async () => {
    await checkRateLimit("k", 1);
    expect((await checkRateLimit("k", 1)).allowed).toBe(false);
    await ageWindow("k", 16);

    expect(await checkRateLimit("k", 1)).toEqual({ allowed: true, remaining: 0 });
    const row = await db.rateLimit.findUniqueOrThrow({ where: { key: "k" } });
    expect(row.count).toBe(1);
    expect(Date.now() - row.windowStart.getTime()).toBeLessThan(MINUTE_MS);
  });

  it("never lets concurrent hits exceed the budget", async () => {
    const results = await Promise.all(Array.from({ length: 25 }, () => checkRateLimit("k", 10)));

    expect(results.filter((r) => r.allowed)).toHaveLength(10);
  });
});

describe("purgeExpiredRateLimits", () => {
  it("deletes only rows whose window has passed", async () => {
    await checkRateLimit("old");
    await checkRateLimit("fresh");
    await ageWindow("old", 16);

    expect(await purgeExpiredRateLimits()).toBe(1);

    const keys = (await db.rateLimit.findMany()).map((r) => r.key);
    expect(keys).toEqual(["fresh"]);
  });
});
