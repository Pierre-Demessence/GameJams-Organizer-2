import { isStaff } from "@/lib/staff-permissions";

// How long a token's `isStaff` claim is trusted before it is re-read from the database. Bounds
// how long a revoked staff role keeps showing in the UI; actions always re-check the database.
export const STAFF_RECHECK_MS = 60_000;

interface StaffClaims {
  id?: string;
  isStaff?: boolean;
  staffCheckedAt?: number;
}

// Refreshes `isStaff` on the token when it was never checked, is older than STAFF_RECHECK_MS,
// or `force` is set (`update()` from the client). Mutates and returns the token.
export async function refreshStaffClaim<T extends StaffClaims>(
  token: T,
  force: boolean,
  now = Date.now()
): Promise<T> {
  if (!token.id) return token;
  const fresh =
    token.isStaff !== undefined &&
    token.staffCheckedAt !== undefined &&
    now - token.staffCheckedAt < STAFF_RECHECK_MS;
  if (fresh && !force) return token;
  token.isStaff = await isStaff(token.id);
  token.staffCheckedAt = now;
  return token;
}
