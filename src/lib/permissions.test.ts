import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hasPermission,
  getJamRoles,
  checkJamPermission,
} from "@/lib/permissions";

const { jamRoleFindMany } = vi.hoisted(() => ({
  jamRoleFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { jamRole: { findMany: jamRoleFindMany } },
}));

describe("hasPermission", () => {
  it("grants nothing to an empty role set", () => {
    expect(hasPermission([], "edit_jam")).toBe(false);
  });

  it("grants a role's own permissions", () => {
    expect(hasPermission(["ADMIN"], "edit_jam")).toBe(true);
    expect(hasPermission(["MODERATOR"], "moderate_submission")).toBe(true);
    expect(hasPermission(["JUDGE"], "rate_as_judge")).toBe(true);
  });

  it("denies permissions a role does not hold", () => {
    expect(hasPermission(["JUDGE"], "moderate_submission")).toBe(false);
    expect(hasPermission(["MODERATOR"], "edit_jam")).toBe(false);
    expect(hasPermission(["HOST"], "edit_jam")).toBe(false);
  });

  it("unions permissions across stacked roles", () => {
    expect(hasPermission(["HOST", "JUDGE"], "rate_as_judge")).toBe(true);
    expect(hasPermission(["JUDGE", "MODERATOR"], "moderate_submission")).toBe(
      true
    );
    expect(hasPermission(["JUDGE", "MODERATOR"], "rate_as_judge")).toBe(true);
  });

  it("does not grant edit_jam unless ADMIN is present", () => {
    expect(hasPermission(["MODERATOR", "JUDGE", "HOST"], "edit_jam")).toBe(
      false
    );
    expect(hasPermission(["MODERATOR", "ADMIN"], "edit_jam")).toBe(true);
  });
});

describe("getJamRoles", () => {
  beforeEach(() => {
    jamRoleFindMany.mockReset();
  });

  it("queries roles scoped to the jam and user and returns their names", async () => {
    jamRoleFindMany.mockResolvedValue([{ role: "ADMIN" }, { role: "JUDGE" }]);

    const roles = await getJamRoles("jam-1", "user-1");

    expect(roles).toEqual(["ADMIN", "JUDGE"]);
    expect(jamRoleFindMany).toHaveBeenCalledWith({
      where: { jamId: "jam-1", userId: "user-1" },
      select: { role: true },
    });
  });

  it("returns an empty array when the user holds no roles", async () => {
    jamRoleFindMany.mockResolvedValue([]);

    expect(await getJamRoles("jam-1", "user-1")).toEqual([]);
  });
});

describe("checkJamPermission", () => {
  beforeEach(() => {
    jamRoleFindMany.mockReset();
  });

  it("grants when a queried role holds the permission", async () => {
    jamRoleFindMany.mockResolvedValue([{ role: "MODERATOR" }]);

    expect(
      await checkJamPermission("jam-1", "user-1", "moderate_submission")
    ).toBe(true);
  });

  it("denies when no queried role holds the permission", async () => {
    jamRoleFindMany.mockResolvedValue([{ role: "JUDGE" }]);

    expect(await checkJamPermission("jam-1", "user-1", "edit_jam")).toBe(false);
  });
});
