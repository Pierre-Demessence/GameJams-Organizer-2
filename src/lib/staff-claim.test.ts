import { beforeEach, describe, expect, it, vi } from "vitest";

const { isStaff, findUser } = vi.hoisted(() => ({ isStaff: vi.fn(), findUser: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ isStaff }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: findUser } } }));

import { refreshTokenClaims, STAFF_RECHECK_MS } from "./staff-claim";

const T0 = 1_000_000;

beforeEach(() => {
  isStaff.mockReset().mockResolvedValue(true);
  findUser.mockReset().mockResolvedValue({ deletedAt: null });
});

describe("refreshTokenClaims", () => {
  it("checks a token that was never checked", async () => {
    const token = await refreshTokenClaims({ id: "u1" }, false, T0);

    expect(token).toEqual({ id: "u1", isStaff: true, staffCheckedAt: T0 });
    expect(isStaff).toHaveBeenCalledWith("u1");
  });

  it("checks a token issued before staffCheckedAt existed", async () => {
    const legacy: { id: string; isStaff: boolean; staffCheckedAt?: number } = {
      id: "u1",
      isStaff: false,
    };
    const token = await refreshTokenClaims(legacy, false, T0);

    expect(token?.isStaff).toBe(true);
    expect(token?.staffCheckedAt).toBe(T0);
  });

  it("keeps a fresh claim without querying", async () => {
    const claims = { id: "u1", isStaff: false, staffCheckedAt: T0 };
    const token = await refreshTokenClaims(claims, false, T0 + STAFF_RECHECK_MS - 1);

    expect(token?.isStaff).toBe(false);
    expect(isStaff).not.toHaveBeenCalled();
  });

  it("re-reads a claim once it is older than the recheck interval", async () => {
    isStaff.mockResolvedValue(false);
    const claims = { id: "u1", isStaff: true, staffCheckedAt: T0 };
    const now = T0 + STAFF_RECHECK_MS;
    const token = await refreshTokenClaims(claims, false, now);

    expect(token).toEqual({ id: "u1", isStaff: false, staffCheckedAt: now });
  });

  it("re-reads a fresh claim when forced by update()", async () => {
    isStaff.mockResolvedValue(false);
    const claims = { id: "u1", isStaff: true, staffCheckedAt: T0 };
    const token = await refreshTokenClaims(claims, true, T0 + 1);

    expect(token?.isStaff).toBe(false);
    expect(isStaff).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a user id", async () => {
    const token = await refreshTokenClaims({}, true, T0);

    expect(token).toEqual({});
    expect(isStaff).not.toHaveBeenCalled();
  });
});

describe("refreshTokenClaims: deleted accounts", () => {
  it("returns null when the user was deleted", async () => {
    findUser.mockResolvedValue({ deletedAt: new Date() });
    const claims = { id: "u1", isStaff: false, staffCheckedAt: T0 };

    expect(await refreshTokenClaims(claims, false, T0 + STAFF_RECHECK_MS)).toBeNull();
    expect(isStaff).not.toHaveBeenCalled();
  });

  it("returns null when the user row is gone", async () => {
    findUser.mockResolvedValue(null);

    expect(await refreshTokenClaims({ id: "u1" }, false, T0)).toBeNull();
  });

  it("does not hit the database while the claims are fresh", async () => {
    findUser.mockResolvedValue({ deletedAt: new Date() });
    const claims = { id: "u1", isStaff: false, staffCheckedAt: T0 };

    expect(await refreshTokenClaims(claims, false, T0 + STAFF_RECHECK_MS - 1)).toBe(claims);
    expect(findUser).not.toHaveBeenCalled();
  });

  it("checks a forced refresh even when fresh", async () => {
    findUser.mockResolvedValue({ deletedAt: new Date() });
    const claims = { id: "u1", isStaff: false, staffCheckedAt: T0 };

    expect(await refreshTokenClaims(claims, true, T0 + 1)).toBeNull();
  });
});

