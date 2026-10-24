// Staff TOTP two-factor (spec §10). The sign-in provider is irrelevant: staff powers need a
// TOTP check passed in this browser, proven by a signed cookie. Secrets are stored encrypted;
// the cookie is an HMAC-signed value, not part of the Auth.js JWT, because a client `update()`
// can push arbitrary data into the session token (docs/decisions.md).
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { staffAccess } from "@/domain/staff";

const ISSUER = "GameJam Organizer";
const PERIOD_SECONDS = 30;
const WINDOW_STEPS = 1;
export const COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;
const COOKIE_KEY_LABEL = "staff-2fa";

export class TwoFactorConfigError extends Error {}

// ─── Secret encryption (AES-256-GCM, `iv.tag.ciphertext` in base64) ─────────

export function parseEncryptionKey(raw: string | undefined): Buffer {
  const key = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (key.length !== 32) {
    throw new TwoFactorConfigError(
      "TOTP_ENCRYPTION_KEY must be 32 bytes, base64 encoded (generate with: openssl rand -base64 32)"
    );
  }
  return key;
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(payload: string, key: Buffer): string {
  const [iv, tag, ciphertext] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !ciphertext) throw new Error("Malformed encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function encryptionKey(): Buffer {
  return parseEncryptionKey(process.env.TOTP_ENCRYPTION_KEY);
}

// ─── Verification cookie ────────────────────────────────────────────────────

export function deriveCookieKey(authSecret: string | undefined): Buffer {
  if (!authSecret) throw new TwoFactorConfigError("NEXTAUTH_SECRET is not set");
  return Buffer.from(hkdfSync("sha256", authSecret, Buffer.alloc(0), COOKIE_KEY_LABEL, 32));
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

// The cookie is bound to the user id and to the enrolment (`enrolledAt`), so a reset followed by a
// fresh enrolment invalidates cookies issued for the old authenticator.
export function signStaffCookie(
  input: { userId: string; enrolledAt: number; expiresAt: number },
  key: Buffer
): string {
  const payload = `${input.userId}.${input.enrolledAt}.${input.expiresAt}`;
  return `${payload}.${sign(payload, key)}`;
}

export function verifyStaffCookie(
  value: string | undefined,
  expected: { userId: string; enrolledAt: number; now: number },
  key: Buffer
): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const [userId, enrolledAt, expiresAt, signature] = parts;
  const payload = `${userId}.${enrolledAt}.${expiresAt}`;
  const given = Buffer.from(signature);
  const wanted = Buffer.from(sign(payload, key));
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return false;
  return (
    userId === expected.userId &&
    Number(enrolledAt) === expected.enrolledAt &&
    Number(expiresAt) > expected.now
  );
}

function cookieSettings() {
  const secure = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  return { name: secure ? "__Host-staff-2fa" : "staff-2fa", secure };
}

export async function issueVerificationCookie(userId: string, enrolledAt: Date): Promise<void> {
  const { name, secure } = cookieSettings();
  const value = signStaffCookie(
    {
      userId,
      enrolledAt: enrolledAt.getTime(),
      expiresAt: Date.now() + COOKIE_MAX_AGE_SECONDS * 1000,
    },
    deriveCookieKey(process.env.NEXTAUTH_SECRET)
  );
  (await cookies()).set(name, value, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function hasVerifiedTwoFactor(userId: string, enrolledAt: Date): Promise<boolean> {
  let key: Buffer;
  try {
    key = deriveCookieKey(process.env.NEXTAUTH_SECRET);
  } catch {
    return false;
  }
  const value = (await cookies()).get(cookieSettings().name)?.value;
  return verifyStaffCookie(value, { userId, enrolledAt: enrolledAt.getTime(), now: Date.now() }, key);
}

// What the staff gate needs to know about this browser and account.
export async function getTwoFactorState(
  userId: string
): Promise<{ enrolled: boolean; verified: boolean }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { totpEnabledAt: true } });
  if (!user?.totpEnabledAt) return { enrolled: false, verified: false };
  return { enrolled: true, verified: await hasVerifiedTwoFactor(userId, user.totpEnabledAt) };
}

// The spec rule applied to this account and browser; skips the lookups when there is no role.
export async function staffGate(userId: string, hasRole: boolean) {
  const state = hasRole ? await getTwoFactorState(userId) : { enrolled: false, verified: false };
  return staffAccess({ hasRole, ...state });
}

// ─── TOTP codes ─────────────────────────────────────────────────────────────

function totpFor(base32: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(base32),
  });
}

// The 30-second step the code belongs to (within ±1 step of `now`), or null if it is wrong.
export function matchTotpStep(base32: string, code: string, now: number): number | null {
  const delta = totpFor(base32, "check").validate({
    token: code,
    timestamp: now,
    window: WINDOW_STEPS,
  });
  if (delta === null) return null;
  return Math.floor(now / 1000 / PERIOD_SECONDS) + delta;
}

export type CodeFailure = "not_enrolled" | "invalid" | "replayed";
export type CodeResult = { ok: true; enrolledAt: Date } | { ok: false; reason: CodeFailure };

// Check-and-set on `totpLastStep` in one guarded update: two concurrent submits of the same code
// cannot both pass.
export async function verifyCode(userId: string, code: string): Promise<CodeResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabledAt: true },
  });
  if (!user?.totpSecret || !user.totpEnabledAt) return { ok: false, reason: "not_enrolled" };

  const step = matchTotpStep(decryptSecret(user.totpSecret, encryptionKey()), code, Date.now());
  if (step === null) return { ok: false, reason: "invalid" };

  const claimed = await db.user.updateMany({
    where: {
      id: userId,
      totpEnabledAt: user.totpEnabledAt,
      OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
    },
    data: { totpLastStep: step },
  });
  if (claimed.count === 0) return { ok: false, reason: "replayed" };
  return { ok: true, enrolledAt: user.totpEnabledAt };
}

// Stores a fresh pending secret (replacing an earlier pending one) and returns what the
// authenticator needs. Returns null when the account is already enrolled.
export async function startEnrolment(
  userId: string,
  label: string
): Promise<{ key: string; qrDataUrl: string } | null> {
  const key = encryptionKey();
  const secret = new OTPAuth.Secret({ size: 20 });
  const stored = await db.user.updateMany({
    where: { id: userId, totpEnabledAt: null },
    data: { totpSecret: encryptSecret(secret.base32, key), totpLastStep: null },
  });
  if (stored.count === 0) return null;

  const uri = totpFor(secret.base32, label).toString();
  // The data URL is rendered in an <img>, never injected as HTML.
  return { key: secret.base32, qrDataUrl: await QRCode.toDataURL(uri, { margin: 2, width: 224 }) };
}

// Activates the pending secret once a valid code proves the authenticator has it. Guarded on the
// stored secret, so a second start (new secret) or a concurrent confirm cannot activate twice.
export async function confirmEnrolment(userId: string, code: string): Promise<CodeResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabledAt: true },
  });
  if (!user?.totpSecret || user.totpEnabledAt) return { ok: false, reason: "not_enrolled" };

  const step = matchTotpStep(decryptSecret(user.totpSecret, encryptionKey()), code, Date.now());
  if (step === null) return { ok: false, reason: "invalid" };

  const enrolledAt = new Date();
  const activated = await db.user.updateMany({
    where: { id: userId, totpEnabledAt: null, totpSecret: user.totpSecret },
    data: { totpEnabledAt: enrolledAt, totpLastStep: step },
  });
  if (activated.count === 0) return { ok: false, reason: "replayed" };
  return { ok: true, enrolledAt };
}

export async function clearTwoFactor(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null },
  });
}
