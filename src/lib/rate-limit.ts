// In-memory sliding window rate limiter (per IP)
// MVP: single-instance deployment. Replace with Redis for distributed setups.

const windowMs = 15 * 60 * 1000; // 15 minutes
const maxAttempts = 10;

const attempts = new Map<string, number[]>();

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

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= maxAttempts) {
    attempts.set(key, timestamps);
    return { allowed: false, remaining: 0 };
  }

  timestamps.push(now);
  attempts.set(key, timestamps);
  return { allowed: true, remaining: maxAttempts - timestamps.length };
}
