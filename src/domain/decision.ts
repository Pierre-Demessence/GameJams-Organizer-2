// Result of a rule check. `reason` is a user-facing message, so actions and
// pages can surface it directly.
export type Decision = { allowed: true } | { allowed: false; reason: string };

export const allow: Decision = { allowed: true };

export function deny(reason: string): Decision {
  return { allowed: false, reason };
}
