import { db } from "@/lib/db";
import type { JamRoleType } from "@/generated/prisma/client";

export type JamPermission =
  | "edit_jam"
  | "manage_roles"
  | "edit_submission"
  | "disqualify_submission"
  | "hide_submission"
  | "delete_submission"
  | "rate_as_judge";

const ROLE_PERMISSIONS: Record<JamRoleType, JamPermission[]> = {
  ADMIN: [
    "edit_jam",
    "manage_roles",
    "edit_submission",
    "disqualify_submission",
    "hide_submission",
    "delete_submission",
  ],
  MODERATOR: [
    "edit_submission",
    "disqualify_submission",
    "hide_submission",
    "delete_submission",
  ],
  JUDGE: ["rate_as_judge"],
  HOST: [],
};

export async function getJamRole(
  jamId: string,
  userId: string
): Promise<JamRoleType | null> {
  const role = await db.jamRole.findUnique({
    where: { jamId_userId: { jamId, userId } },
  });
  return role?.role ?? null;
}

export function hasPermission(
  role: JamRoleType | null,
  permission: JamPermission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export async function checkJamPermission(
  jamId: string,
  userId: string,
  permission: JamPermission
): Promise<boolean> {
  const role = await getJamRole(jamId, userId);
  return hasPermission(role, permission);
}
