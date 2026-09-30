import { db } from "@/lib/db";
import type {
  JamRoleType,
  StaffRoleType,
} from "@/generated/prisma/client";

let seq = 0;

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

export function createUser(username?: string) {
  seq += 1;
  return db.user.create({
    data: { username: username ?? `user_${seq}` },
  });
}

export function createJam(
  createdById: string,
  overrides?: {
    name?: string;
    slug?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    ratingEnd?: Date | null;
    ranked?: boolean;
    visibility?: "PUBLIC" | "UNLISTED";
    publishedAt?: Date | null;
    ratingEligibility?:
      | "SUBMITTERS_ONLY"
      | "SUBMITTERS_AND_CONTRIBUTORS"
      | "JUDGES_ONLY"
      | "EVERYONE";
  }
) {
  seq += 1;
  return db.jam.create({
    data: {
      name: overrides?.name ?? `Jam ${seq}`,
      slug: overrides?.slug ?? `jam-${seq}`,
      shortDesc: "Short description",
      fullDesc: "Full description",
      createdById,
      startDate: overrides?.startDate,
      endDate: overrides?.endDate,
      ratingEnd: overrides?.ratingEnd,
      ranked: overrides?.ranked,
      visibility: overrides?.visibility,
      publishedAt: overrides?.publishedAt,
      ratingEligibility: overrides?.ratingEligibility,
    },
  });
}

// A published jam whose window is open now, so jamPhase() returns "ONGOING".
export function createOngoingJam(
  createdById: string,
  overrides?: { slug?: string }
) {
  return createJam(createdById, {
    slug: overrides?.slug,
    publishedAt: daysFromNow(-2),
    startDate: daysFromNow(-1),
    endDate: daysFromNow(1),
  });
}

// A published jam whose window has closed, so jamPhase() returns "FINISHED".
export function createFinishedJam(
  createdById: string,
  overrides?: { slug?: string }
) {
  return createJam(createdById, {
    slug: overrides?.slug,
    publishedAt: daysFromNow(-4),
    startDate: daysFromNow(-3),
    endDate: daysFromNow(-1),
  });
}

export function joinJam(jamId: string, userId: string) {
  return db.jamParticipant.create({ data: { jamId, userId } });
}

export function createSubmission(
  jamId: string,
  leaderUserId: string,
  overrides?: { title?: string }
) {
  seq += 1;
  return db.submission.create({
    data: {
      jamId,
      title: overrides?.title ?? `Submission ${seq}`,
      members: { create: { userId: leaderUserId, isLeader: true } },
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

export function submissionFormData(overrides?: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("title", "My Game");
  for (const [key, value] of Object.entries(overrides ?? {})) {
    fd.set(key, value);
  }
  return fd;
}
