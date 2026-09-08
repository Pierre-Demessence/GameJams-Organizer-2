import { db } from "@/lib/db";
import type {
  JamRoleType,
  StaffRoleType,
} from "@/generated/prisma/client";

let seq = 0;

export function createUser(username?: string) {
  seq += 1;
  return db.user.create({
    data: { username: username ?? `user_${seq}` },
  });
}

export function createJam(
  createdById: string,
  overrides?: { name?: string; slug?: string }
) {
  seq += 1;
  return db.jam.create({
    data: {
      name: overrides?.name ?? `Jam ${seq}`,
      slug: overrides?.slug ?? `jam-${seq}`,
      shortDesc: "Short description",
      fullDesc: "Full description",
      createdById,
    },
  });
}

export function grantJamRole(jamId: string, userId: string, role: JamRoleType) {
  return db.jamRole.create({ data: { jamId, userId, role } });
}

export function grantStaffRole(
  userId: string,
  role: StaffRoleType = "SITE_ADMIN"
) {
  return db.staffRole.create({ data: { userId, role } });
}

export function jamFormData(overrides?: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("name", "Updated Jam");
  fd.set("slug", "updated-jam");
  fd.set("shortDesc", "Short description");
  fd.set("fullDesc", "Full description");
  for (const [key, value] of Object.entries(overrides ?? {})) {
    fd.set(key, value);
  }
  return fd;
}
