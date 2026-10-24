"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { isStaff } from "@/lib/staff-permissions";
import {
  confirmEnrolment,
  issueVerificationCookie,
  startEnrolment,
  TwoFactorConfigError,
  verifyCode,
  type CodeResult,
} from "@/lib/two-factor";
import { twoFactorCodeSchema } from "@/lib/validations";

const NOT_CONFIGURED = "Two-factor authentication is not configured on this server";
const BAD_CODE = "That code is not valid. Check your authenticator app and try again.";
const TOO_MANY = "Too many attempts. Please try again later.";

// Staff only: a non-staff account has nothing to enrol for.
async function staffUserId(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !(await isStaff(userId))) return null;
  return userId;
}

// The audit list names a row by `metadata.username`, so these entries are readable.
async function usernameOf(userId: string): Promise<string | undefined> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
  return user?.username;
}

// `?: never` keeps `.error` readable on both branches, like the inferred results of other actions.
type StartResult =
  | { error: string; key?: never; qrDataUrl?: never }
  | { error?: never; key: string; qrDataUrl: string };
type SubmitResult = { error: string; success?: never } | { error?: never; success: true };

export async function startEnrolmentAction(): Promise<StartResult> {
  const userId = await staffUserId();
  if (!userId) return { error: "You do not have permission" };
  if (!(await checkRateLimit(`2fa-start:${userId}`)).allowed) return { error: TOO_MANY };

  try {
    const enrolment = await startEnrolment(userId, (await usernameOf(userId)) ?? userId);
    if (!enrolment) return { error: "Two-factor authentication is already set up" };
    return enrolment;
  } catch (err) {
    if (err instanceof TwoFactorConfigError) return { error: NOT_CONFIGURED };
    throw err;
  }
}

// Shared by enrol-confirm and verify: both take a 6-digit code and end with a cookie.
async function submitCode(
  stage: "enrol" | "verify",
  code: string,
  check: (userId: string, code: string) => Promise<CodeResult>
): Promise<SubmitResult> {
  const userId = await staffUserId();
  if (!userId) return { error: "You do not have permission" };
  if (!(await checkRateLimit(`2fa:${userId}`)).allowed) return { error: TOO_MANY };

  const parsed = twoFactorCodeSchema.safeParse(code);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let result: CodeResult;
  try {
    result = await check(userId, parsed.data);
    if (result.ok) await issueVerificationCookie(userId, result.enrolledAt);
  } catch (err) {
    if (err instanceof TwoFactorConfigError) return { error: NOT_CONFIGURED };
    throw err;
  }

  if (!result.ok) {
    if (result.reason === "not_enrolled") {
      return { error: stage === "enrol" ? "Start the setup again" : "Set up two-factor authentication first" };
    }
    await recordAudit({
      actorId: userId,
      action: "auth:2fa_failed",
      targetType: "user",
      targetId: userId,
      metadata: { username: await usernameOf(userId), stage, reason: result.reason },
    });
    return { error: BAD_CODE };
  }

  if (stage === "enrol") {
    await recordAudit({
      actorId: userId,
      action: "auth:2fa_enrol",
      targetType: "user",
      targetId: userId,
      metadata: { username: await usernameOf(userId) },
    });
  }
  revalidatePath("/admin");
  return { success: true };
}

export async function confirmEnrolmentAction(code: string) {
  return submitCode("enrol", code, confirmEnrolment);
}

export async function verifyTwoFactorAction(code: string) {
  return submitCode("verify", code, verifyCode);
}
