import { db } from "@/lib/db";
import { isStaff } from "@/lib/staff-permissions";

// How long a token's claims are trusted before they are re-read from the database. Bounds how
// long a revoked staff role keeps showing in the UI, and how long a deleted account's token
// stays valid on other devices; actions always re-check the database.
export const STAFF_RECHECK_MS = 60_000;

interface StaffClaims {
  id?: string;
  isStaff?: boolean;
  staffCheckedAt?: number;
}

// Refreshes the claims on the token when they were never checked, are older than
// STAFF_RECHECK_MS, or `force` is set (`update()` from the client): `isStaff`, and whether the
// account still exists. Returns null for a deleted or missing user so the `jwt` callback can end
// the session. Mutates and returns the token otherwise.
export async function refreshTokenClaims<T extends StaffClaims>(
  token: T,
  force: boolean,
  now = Date.now()
): Promise<T | null> {
  if (!token.id) return token;
  const fresh =
    token.isStaff !== undefined &&
    token.staffCheckedAt !== undefined &&
    now - token.staffCheckedAt < STAFF_RECHECK_MS;
  if (fresh && !force) return token;
  const account = await db.user.findUnique({
    where: { id: token.id },
    select: { deletedAt: true },
  });
  if (!account || account.deletedAt) return null;
  token.isStaff = await isStaff(token.id);
  token.staffCheckedAt = now;
  return token;
}
