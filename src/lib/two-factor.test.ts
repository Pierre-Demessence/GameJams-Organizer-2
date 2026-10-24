import { describe, expect, it, vi } from "vitest";
import * as OTPAuth from "otpauth";
import {
  decryptSecret,
  deriveCookieKey,
  encryptSecret,
  matchTotpStep,
  parseEncryptionKey,
  signStaffCookie,
  TwoFactorConfigError,
  verifyStaffCookie,
} from "@/lib/two-factor";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const KEY = Buffer.alloc(32, 7);

describe("parseEncryptionKey", () => {
  it("accepts 32 bytes of base64", () => {
    expect(parseEncryptionKey(KEY.toString("base64")).equals(KEY)).toBe(true);
  });

  it.each([undefined, "", "not-a-key", Buffer.alloc(16).toString("base64")])(
    "rejects a missing or malformed key (%s)",
    (raw) => {
      expect(() => parseEncryptionKey(raw)).toThrow(TwoFactorConfigError);
    }
  );
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a secret", () => {
    expect(decryptSecret(encryptSecret("JBSWY3DPEHPK3PXP", KEY), KEY)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("does not contain the plaintext and differs per call", () => {
    const a = encryptSecret("JBSWY3DPEHPK3PXP", KEY);
    expect(a).not.toContain("JBSWY3DPEHPK3PXP");
    expect(encryptSecret("JBSWY3DPEHPK3PXP", KEY)).not.toBe(a);
  });

  it("refuses a different key", () => {
    const stored = encryptSecret("JBSWY3DPEHPK3PXP", KEY);
    expect(() => decryptSecret(stored, Buffer.alloc(32, 8))).toThrow();
  });

  it("refuses tampered ciphertext and malformed payloads", () => {
    const [iv, tag, ct] = encryptSecret("JBSWY3DPEHPK3PXP", KEY).split(".");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 1;
    expect(() => decryptSecret([iv, tag, flipped.toString("base64")].join("."), KEY)).toThrow();
    expect(() => decryptSecret("garbage", KEY)).toThrow();
  });
});

describe("staff cookie", () => {
  const key = deriveCookieKey("a-test-secret-a-test-secret");
  const now = 1_000_000;
  const input = { userId: "user_1", enrolledAt: 500, expiresAt: now + 60_000 };
  const expected = { userId: "user_1", enrolledAt: 500, now };

  it("verifies a fresh cookie for its user and enrolment", () => {
    expect(verifyStaffCookie(signStaffCookie(input, key), expected, key)).toBe(true);
  });

  it("refuses an expired cookie", () => {
    const value = signStaffCookie({ ...input, expiresAt: now - 1 }, key);
    expect(verifyStaffCookie(value, expected, key)).toBe(false);
  });

  it("refuses another user's cookie", () => {
    const value = signStaffCookie({ ...input, userId: "user_2" }, key);
    expect(verifyStaffCookie(value, expected, key)).toBe(false);
  });

  it("refuses a cookie issued for an earlier enrolment", () => {
    const value = signStaffCookie({ ...input, enrolledAt: 100 }, key);
    expect(verifyStaffCookie(value, expected, key)).toBe(false);
  });

  it("refuses a forged expiry and a signature from another key", () => {
    const value = signStaffCookie(input, key);
    const [userId, enrolledAt, , signature] = value.split(".");
    const forged = [userId, enrolledAt, String(now + 10 ** 12), signature].join(".");
    expect(verifyStaffCookie(forged, expected, key)).toBe(false);
    expect(verifyStaffCookie(value, expected, deriveCookieKey("another-secret-another-secret"))).toBe(false);
  });

  it("refuses missing and malformed values", () => {
    expect(verifyStaffCookie(undefined, expected, key)).toBe(false);
    expect(verifyStaffCookie("", expected, key)).toBe(false);
    expect(verifyStaffCookie("a.b.c", expected, key)).toBe(false);
    expect(verifyStaffCookie("a.b.c.d", expected, key)).toBe(false);
  });
});

describe("deriveCookieKey", () => {
  it("is deterministic per secret and fails closed without one", () => {
    expect(deriveCookieKey("s").equals(deriveCookieKey("s"))).toBe(true);
    expect(deriveCookieKey("s").equals(deriveCookieKey("t"))).toBe(false);
    expect(() => deriveCookieKey(undefined)).toThrow(TwoFactorConfigError);
  });
});

describe("matchTotpStep", () => {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 });
  const now = 1_700_000_000_000;
  const step = Math.floor(now / 1000 / 30);

  it("returns the step of a current code", () => {
    expect(matchTotpStep(secret, totp.generate({ timestamp: now }), now)).toBe(step);
  });

  it("accepts the adjacent steps and reports their own step", () => {
    expect(matchTotpStep(secret, totp.generate({ timestamp: now - 30_000 }), now)).toBe(step - 1);
    expect(matchTotpStep(secret, totp.generate({ timestamp: now + 30_000 }), now)).toBe(step + 1);
  });

  it("refuses codes outside ±1 step, wrong codes and non-digits", () => {
    expect(matchTotpStep(secret, totp.generate({ timestamp: now - 90_000 }), now)).toBeNull();
    const code = totp.generate({ timestamp: now });
    const wrong = code.slice(0, 5) + ((Number(code[5]) + 1) % 10);
    expect(matchTotpStep(secret, wrong, now)).toBeNull();
    expect(matchTotpStep(secret, "abcdef", now)).toBeNull();
  });
});
