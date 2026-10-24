import { describe, expect, it } from "vitest";
import { staffAccess } from "@/domain/staff";

describe("staffAccess", () => {
  it("allows a staff member who is enrolled and verified", () => {
    expect(staffAccess({ hasRole: true, enrolled: true, verified: true })).toEqual({ allowed: true });
  });

  it("denies a user without a staff role, whatever their 2FA state", () => {
    expect(staffAccess({ hasRole: false, enrolled: true, verified: true })).toEqual({
      allowed: false,
      reason: "You do not have staff access",
    });
  });

  it("asks a staff member without an authenticator to set one up", () => {
    expect(staffAccess({ hasRole: true, enrolled: false, verified: false })).toEqual({
      allowed: false,
      reason: "Set up two-factor authentication",
    });
  });

  it("asks an enrolled staff member without a valid cookie for a code", () => {
    expect(staffAccess({ hasRole: true, enrolled: true, verified: false })).toEqual({
      allowed: false,
      reason: "Enter your two-factor code",
    });
  });

  it("never treats a cookie as enough when the member is not enrolled", () => {
    expect(staffAccess({ hasRole: true, enrolled: false, verified: true }).allowed).toBe(false);
  });
});
