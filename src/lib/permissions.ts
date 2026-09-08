import { db } from "@/lib/db";
import type { JamRoleType } from "@/generated/prisma/client";

export type JamPermission =
  | "edit_jam"
  | "delete_jam"
  | "manage_roles"
  | "edit_submission"
  | "moderate_submission"
  | "delete_submission"
  | "verify_submission"
  | "rate_as_judge";

const ROLE_PERMISSIONS: Record<JamRoleType, JamPermission[]> = {
  ADMIN: [
    "edit_jam",
    "delete_jam",
    "manage_roles",
    "edit_submission",
    "moderate_submission",
    "delete_submission",
    "verify_submission",
  ],
  MODERATOR: [
    "edit_submission",
    "moderate_submission",
    "delete_submission",
    "verify_submission",
  ],
  JUDGE: ["rate_as_judge"],
  HOST: [],
};

export async function getJamRoles(
  jamId: string,
  userId: string
): Promise<JamRoleType[]> {
  const roles = await db.jamRole.findMany({
    where: { jamId, userId },
    select: { role: true },
  });
  return roles.map((r) => r.role);
}

export function hasPermission(
  roles: JamRoleType[],
  permission: JamPermission
): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export async function checkJamPermission(
  jamId: string,
  userId: string,
  permission: JamPermission
): Promise<boolean> {
  const roles = await getJamRoles(jamId, userId);
  return hasPermission(roles, permission);
}
