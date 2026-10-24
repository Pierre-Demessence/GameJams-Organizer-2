import { afterEach, describe, expect, it } from "vitest";
import { resetTwoFactorAction, restoreJamAction } from "@/app/admin/actions";
import {
  confirmEnrolmentAction,
  startEnrolmentAction,
  verifyTwoFactorAction,
} from "@/app/admin/two-factor/actions";
import { db } from "@/lib/db";
import { checkStaffPermission } from "@/lib/staff-permissions";
import { deriveCookieKey, signStaffCookie } from "@/lib/two-factor";
import { clearCookies, cookieEntry, cookieJar } from "./cookie-jar";
import { actingAs } from "./current-session";
import {
  createUser,
  enrolTotp,
  grantStaffRole,
  grantVerifiedStaffRole,
  passTwoFactor,
  totpCode,
} from "./factories";

const COOKIE = "staff-2fa";

async function enrolledStaff() {
  const user = await createUser();
  await grantStaffRole(user.id);
  const secret = await enrolTotp(user.id);
  return { user, secret };
}

describe("staff permissions need a verified browser", () => {
  it("refuses staff who have not enrolled", async () => {
    const user = await createUser();
    await grantStaffRole(user.id);

    expect(await checkStaffPermission(user.id, "manage_staff")).toBe(false);
  });

  it("refuses enrolled staff without the 2FA cookie, and accepts them once it is set", async () => {
    const { user } = await enrolledStaff();
    expect(await checkStaffPermission(user.id, "manage_staff")).toBe(false);

    await passTwoFactor(user.id);

    expect(await checkStaffPermission(user.id, "manage_staff")).toBe(true);
  });

  it("refuses a cookie that is expired or belongs to another user", async () => {
    const { user } = await enrolledStaff();
    const other = await enrolledStaff();
    const { totpEnabledAt } = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { totpEnabledAt: true },
    });
    const key = deriveCookieKey(process.env.NEXTAUTH_SECRET);
    const enrolledAt = totpEnabledAt!.getTime();

    cookieJar.set(COOKIE, signStaffCookie({ userId: user.id, enrolledAt, expiresAt: Date.now() - 1000 }, key));
    expect(await checkStaffPermission(user.id, "manage_staff")).toBe(false);

    await passTwoFactor(user.id);
    expect(await checkStaffPermission(user.id, "manage_staff")).toBe(true);
    expect(await checkStaffPermission(other.user.id, "manage_staff")).toBe(false);
  });

  it("gives no staff permission to a user without a staff role, even with a cookie", async () => {
    const user = await createUser();
    await enrolTotp(user.id);
    await passTwoFactor(user.id);

    expect(await checkStaffPermission(user.id, "manage_staff")).toBe(false);
  });
});

describe("verifyTwoFactorAction", () => {
  it("accepts a valid code and sets a signed, HttpOnly, SameSite=Strict cookie for 12 hours", async () => {
    const { user, secret } = await enrolledStaff();
    actingAs(user.id);

    expect(await verifyTwoFactorAction(totpCode(secret))).toEqual({ success: true });

    expect(cookieEntry(COOKIE)?.options).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 12 * 60 * 60,
    });
    expect(await checkStaffPermission(user.id, "manage_staff")).toBe(true);
  });

  it("accepts a code with a space in the middle, as authenticator apps display it", async () => {
    const { user, secret } = await enrolledStaff();
    actingAs(user.id);
    const code = totpCode(secret);

    expect(await verifyTwoFactorAction(`${code.slice(0, 3)} ${code.slice(3)}`)).toEqual({ success: true });
  });

  it("refuses a wrong code and audits the failure without setting a cookie", async () => {
    const { user, secret } = await enrolledStaff();
    actingAs(user.id);
    const code = totpCode(secret);
    const wrong = code.slice(0, 5) + ((Number(code[5]) + 1) % 10);

    expect((await verifyTwoFactorAction(wrong)).error).toMatch(/not valid/);

    expect(cookieEntry(COOKIE)).toBeUndefined();
    const audits = await db.auditLogEntry.findMany({ where: { action: "auth:2fa_failed" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actorId: user.id, targetId: user.id });
  });

  it("refuses malformed input before checking it", async () => {
    const { user } = await enrolledStaff();
    actingAs(user.id);

    expect((await verifyTwoFactorAction("12345")).error).toMatch(/6-digit/);
    expect((await verifyTwoFactorAction("abcdef")).error).toMatch(/6-digit/);
    expect(await db.auditLogEntry.count()).toBe(0);
  });

  it("refuses a replayed code and any code from an earlier 30-second step", async () => {
    const { user, secret } = await enrolledStaff();
    actingAs(user.id);
    const current = totpCode(secret);
    expect(await verifyTwoFactorAction(current)).toEqual({ success: true });
    clearCookies();

    expect((await verifyTwoFactorAction(current)).error).toMatch(/not valid/);
    expect((await verifyTwoFactorAction(totpCode(secret, -1))).error).toMatch(/not valid/);
    expect(cookieEntry(COOKIE)).toBeUndefined();

    expect(await verifyTwoFactorAction(totpCode(secret, 1))).toEqual({ success: true });
  });

  it("lets only one of two concurrent submissions of the same code through", async () => {
    const { user, secret } = await enrolledStaff();
    actingAs(user.id);
    const code = totpCode(secret);

    const results = await Promise.all([verifyTwoFactorAction(code), verifyTwoFactorAction(code)]);

    expect(results.filter((r) => "success" in r)).toHaveLength(1);
  });

  it("rate-limits attempts per user", async () => {
    const { user } = await enrolledStaff();
    actingAs(user.id);

    for (let i = 0; i < 10; i += 1) await verifyTwoFactorAction("000000");

    expect((await verifyTwoFactorAction("000000")).error).toMatch(/Too many/);
  });

  it("refuses a user who is not staff or not enrolled", async () => {
    const member = await createUser();
    await enrolTotp(member.id);
    actingAs(member.id);
    expect((await verifyTwoFactorAction("123456")).error).toMatch(/permission/);

    const staffOnly = await createUser();
    await grantStaffRole(staffOnly.id);
    actingAs(staffOnly.id);
    expect((await verifyTwoFactorAction("123456")).error).toMatch(/Set up two-factor/);
  });
});

describe("enrolment", () => {
  const savedKey = process.env.TOTP_ENCRYPTION_KEY;
  afterEach(() => {
    process.env.TOTP_ENCRYPTION_KEY = savedKey;
  });

  it("stores an encrypted pending secret, then enables 2FA once a valid code is entered", async () => {
    const user = await createUser();
    await grantStaffRole(user.id);
    actingAs(user.id);

    const setup = await startEnrolmentAction();
    if (setup.error !== undefined) throw new Error(setup.error);

    expect(setup.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const pending = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(pending.totpEnabledAt).toBeNull();
    expect(pending.totpSecret).not.toBeNull();
    expect(pending.totpSecret).not.toContain(setup.key);
    expect(await checkStaffPermission(user.id, "manage_staff")).toBe(false);

    expect((await confirmEnrolmentAction("000000")).error).toMatch(/not valid|6-digit/);
    expect(await confirmEnrolmentAction(totpCode(setup.key))).toEqual({ success: true });

    const enrolled = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(enrolled.totpEnabledAt).not.toBeNull();
    expect(await checkStaffPermission(user.id, "manage_staff")).toBe(true);
    expect(await db.auditLogEntry.count({ where: { action: "auth:2fa_enrol", actorId: user.id } })).toBe(1);
  });

  it("does not let a used enrolment code verify again", async () => {
    const user = await createUser();
    await grantStaffRole(user.id);
    actingAs(user.id);
    const setup = await startEnrolmentAction();
    if (setup.error !== undefined) throw new Error(setup.error);
    const code = totpCode(setup.key);
    await confirmEnrolmentAction(code);
    clearCookies();

    expect((await verifyTwoFactorAction(code)).error).toMatch(/not valid/);
  });

  it("replaces a pending secret when setup is started again, so the first QR no longer works", async () => {
    const user = await createUser();
    await grantStaffRole(user.id);
    actingAs(user.id);
    const first = await startEnrolmentAction();
    const second = await startEnrolmentAction();
    if (first.error !== undefined || second.error !== undefined) throw new Error("setup failed");

    expect((await confirmEnrolmentAction(totpCode(first.key))).error).toMatch(/not valid/);
    expect(await confirmEnrolmentAction(totpCode(second.key))).toEqual({ success: true });
  });

  it("refuses to start for non-staff and for an account that is already enrolled", async () => {
    const member = await createUser();
    actingAs(member.id);
    expect((await startEnrolmentAction()).error).toMatch(/permission/);

    const { user } = await enrolledStaff();
    actingAs(user.id);
    expect((await startEnrolmentAction()).error).toMatch(/already set up/);
  });

  it("fails clearly and stores nothing when TOTP_ENCRYPTION_KEY is missing", async () => {
    const user = await createUser();
    await grantStaffRole(user.id);
    actingAs(user.id);
    delete process.env.TOTP_ENCRYPTION_KEY;

    expect((await startEnrolmentAction()).error).toMatch(/not configured/);

    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.totpSecret).toBeNull();
  });
});

describe("resetTwoFactorAction", () => {
  it("clears another staff member's 2FA, audits it, and invalidates their old cookie", async () => {
    const admin = await createUser();
    await grantVerifiedStaffRole(admin.id);
    const { user: target } = await enrolledStaff();
    await passTwoFactor(target.id);
    expect(await checkStaffPermission(target.id, "manage_staff")).toBe(true);
    const oldCookie = cookieEntry(COOKIE)!.value;
    await passTwoFactor(admin.id);
    actingAs(admin.id);

    expect(await resetTwoFactorAction(target.id)).toEqual({ success: true });

    expect(await db.user.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({
      totpSecret: null,
      totpEnabledAt: null,
      totpLastStep: null,
    });
    expect(await db.auditLogEntry.count({ where: { action: "staff:2fa_reset", targetId: target.id, actorId: admin.id } })).toBe(1);

    // Re-enrolling gives a new enrolment, so the cookie from before the reset stays useless.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await enrolTotp(target.id);
    cookieJar.set(COOKIE, oldCookie);
    expect(await checkStaffPermission(target.id, "manage_staff")).toBe(false);
  });

  it("refuses a self-reset, a non-staff target and an unverified caller", async () => {
    const admin = await createUser();
    await grantVerifiedStaffRole(admin.id);
    const member = await createUser();
    actingAs(admin.id);

    expect((await resetTwoFactorAction(admin.id)).error).toMatch(/your own/);
    expect((await resetTwoFactorAction(member.id)).error).toMatch(/not found/);
    expect(await db.user.findUniqueOrThrow({ where: { id: admin.id } })).toMatchObject({
      totpEnabledAt: expect.any(Date),
    });

    const { user: unverified } = await enrolledStaff();
    actingAs(unverified.id);
    expect((await resetTwoFactorAction(admin.id)).error).toMatch(/permission/);
  });

});

describe("staff actions", () => {
  it("fail for enrolled staff until the browser is verified", async () => {
    const { user } = await enrolledStaff();
    actingAs(user.id);

    expect((await restoreJamAction("missing")).error).toMatch(/permission/);

    await passTwoFactor(user.id);
    expect((await restoreJamAction("missing")).error).toMatch(/not found/);
  });
});
