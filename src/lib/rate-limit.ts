// Fixed-window rate limiter backed by Postgres, so every replica shares one budget per key.
// One row per key holds the window start and the hit count; a single atomic upsert counts the
// hit and rolls the window over, so concurrent requests on different pods cannot lose updates.
// Hits beyond `max` keep incrementing the row but never extend the window.
import { db } from "@/lib/db";

const WINDOW_SECONDS = 15 * 60;
const maxAttempts = 10;
const CLEANUP_INTERVAL_MS = 60_000;

let lastCleanup = Date.now();

// Rows whose window has passed are dead weight (forged keys such as spoofed IPs would otherwise
// accumulate), so each process purges them at most once a minute.
export async function purgeExpiredRateLimits(): Promise<number> {
  return db.$executeRaw`
    DELETE FROM "RateLimit"
    WHERE "windowStart" < now() - (${WINDOW_SECONDS}::int * interval '1 second')
  `;
}

// `max` raises the budget for cheap, frequent reads such as as-you-type availability checks.
export async function checkRateLimit(
  key: string,
  max = maxAttempts
): Promise<{ allowed: boolean; remaining: number }> {
  if (Date.now() - lastCleanup >= CLEANUP_INTERVAL_MS) {
    lastCleanup = Date.now();
    purgeExpiredRateLimits().catch(() => {
      // Best effort: a failed purge only delays cleanup to the next interval.
    });
  }

  // The window test uses the database clock (`now()`), never a pod's, so replicas with skewed
  // clocks agree on when a window ends.
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count")
    VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" < now() - (${WINDOW_SECONDS}::int * interval '1 second')
        THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" < now() - (${WINDOW_SECONDS}::int * interval '1 second')
        THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count"::int AS "count"
  `;
  const count = rows[0].count;
  return { allowed: count <= max, remaining: Math.max(0, max - count) };
}
