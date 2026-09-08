import { db } from "@/lib/db";
import type { StaffRoleType } from "@/generated/prisma/client";

export type StaffPermission =
  | "edit_any_jam"
  | "delete_any_jam"
  | "moderate_any_submission"
  | "manage_staff"
  | "view_audit_log";

const STAFF_ROLE_PERMISSIONS: Record<StaffRoleType, StaffPermission[]> = {
  SITE_ADMIN: [
    "edit_any_jam",
    "delete_any_jam",
    "moderate_any_submission",
    "manage_staff",
    "view_audit_log",
  ],
};

export async function getStaffRoles(userId: string): Promise<StaffRoleType[]> {
  const roles = await db.staffRole.findMany({
    where: { userId },
    select: { role: true },
  });
  return roles.map((r) => r.role);
}

export function hasStaffPermission(
  roles: StaffRoleType[],
  permission: StaffPermission
): boolean {
  return roles.some((role) => STAFF_ROLE_PERMISSIONS[role].includes(permission));
}

export async function isStaff(userId: string): Promise<boolean> {
  const count = await db.staffRole.count({ where: { userId } });
  return count > 0;
}

export async function checkStaffPermission(
  userId: string,
  permission: StaffPermission
): Promise<boolean> {
  const roles = await getStaffRoles(userId);
  return hasStaffPermission(roles, permission);
}
