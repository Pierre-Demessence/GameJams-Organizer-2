// In-memory sliding window rate limiter (per IP)
// MVP: single-instance deployment. Replace with Redis for distributed setups.

const windowMs = 15 * 60 * 1000; // 15 minutes
const maxAttempts = 10;

const attempts = new Map<string, number[]>();
// Bounds memory if keys are forged (e.g. spoofed IPs): the oldest-inserted key goes first.
const MAX_KEYS = 50_000;

// Periodic cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of attempts) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) {
      attempts.delete(key);
    } else {
      attempts.set(key, valid);
    }
  }
}, 60_000);

// `max` raises the budget for cheap, frequent reads such as as-you-type availability checks.
export function checkRateLimit(key: string, max = maxAttempts): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= max) {
    attempts.set(key, timestamps);
    return { allowed: false, remaining: 0 };
  }

  timestamps.push(now);
  if (!attempts.has(key) && attempts.size >= MAX_KEYS) {
    const oldest = attempts.keys().next().value;
    if (oldest !== undefined) attempts.delete(oldest);
  }
  attempts.set(key, timestamps);
  return { allowed: true, remaining: max - timestamps.length };
}
