import * as OTPAuth from "otpauth";
import { db } from "@/lib/db";
import { encryptSecret, issueVerificationCookie, parseEncryptionKey } from "@/lib/two-factor";
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

export function addMember(submissionId: string, userId: string) {
  return db.submissionMember.create({ data: { submissionId, userId, isLeader: false } });
}

export function createInvite(submissionId: string, inviteeId: string, invitedById: string) {
  return db.submissionInvite.create({ data: { submissionId, inviteeId, invitedById } });
}

// A ranked jam in its RATING period, so jamPhase() returns "RATING".
export async function createRatingJam(
  createdById: string,
  overrides?: { allowContributorsAfterClose?: boolean }
) {
  const jam = await createJam(createdById, {
    publishedAt: daysFromNow(-4),
    startDate: daysFromNow(-3),
    endDate: daysFromNow(-1),
    ratingEnd: daysFromNow(3),
    ranked: true,
  });
  if (!overrides?.allowContributorsAfterClose) return jam;
  return db.jam.update({ where: { id: jam.id }, data: { allowContributorsAfterClose: true } });
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

// Gives the user a working authenticator (enrolment complete) and returns its base32 secret.
export async function enrolTotp(userId: string): Promise<string> {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  await db.user.update({
    where: { id: userId },
    data: {
      totpSecret: encryptSecret(secret, parseEncryptionKey(process.env.TOTP_ENCRYPTION_KEY)),
      totpEnabledAt: new Date(),
    },
  });
  return secret;
}

// A valid code for the secret; `steps` shifts it by 30-second steps (negative = earlier).
export function totpCode(secret: string, steps = 0): string {
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 }).generate({
    timestamp: Date.now() + steps * 30_000,
  });
}

// Puts a valid staff-2FA cookie for this user in the test browser.
export async function passTwoFactor(userId: string): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { totpEnabledAt: true } });
  await issueVerificationCookie(userId, user.totpEnabledAt!);
}

// Staff role, enrolled authenticator and a verified browser: what staff powers need.
export async function grantVerifiedStaffRole(userId: string): Promise<{ secret: string }> {
  await grantStaffRole(userId);
  const secret = await enrolTotp(userId);
  await passTwoFactor(userId);
  return { secret };
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
