import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hasStaffPermission,
  getStaffRoles,
  isStaff,
  checkStaffPermission,
} from "@/lib/staff-permissions";

const { staffFindMany, staffCount } = vi.hoisted(() => ({
  staffFindMany: vi.fn(),
  staffCount: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { staffRole: { findMany: staffFindMany, count: staffCount } },
}));

describe("hasStaffPermission", () => {
  it("grants a Site Admin every staff permission", () => {
    expect(hasStaffPermission(["SITE_ADMIN"], "edit_any_jam")).toBe(true);
    expect(hasStaffPermission(["SITE_ADMIN"], "delete_any_jam")).toBe(true);
    expect(hasStaffPermission(["SITE_ADMIN"], "moderate_any_submission")).toBe(true);
    expect(hasStaffPermission(["SITE_ADMIN"], "manage_staff")).toBe(true);
    expect(hasStaffPermission(["SITE_ADMIN"], "view_audit_log")).toBe(true);
  });

  it("denies a user with no staff roles", () => {
    expect(hasStaffPermission([], "view_audit_log")).toBe(false);
    expect(hasStaffPermission([], "manage_staff")).toBe(false);
  });
});

describe("getStaffRoles", () => {
  beforeEach(() => {
    staffFindMany.mockReset();
  });

  it("queries staff roles for the user and returns their names", async () => {
    staffFindMany.mockResolvedValue([{ role: "SITE_ADMIN" }]);

    expect(await getStaffRoles("user-1")).toEqual(["SITE_ADMIN"]);
    expect(staffFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { role: true },
    });
  });

  it("returns an empty array when the user has no staff roles", async () => {
    staffFindMany.mockResolvedValue([]);

    expect(await getStaffRoles("user-1")).toEqual([]);
  });
});

describe("isStaff", () => {
  beforeEach(() => {
    staffCount.mockReset();
  });

  it("is true when the user has at least one staff role", async () => {
    staffCount.mockResolvedValue(1);

    expect(await isStaff("user-1")).toBe(true);
    expect(staffCount).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("is false when the user has no staff roles", async () => {
    staffCount.mockResolvedValue(0);

    expect(await isStaff("user-1")).toBe(false);
  });
});

describe("checkStaffPermission", () => {
  beforeEach(() => {
    staffFindMany.mockReset();
  });

  it("grants when the user's staff role holds the permission", async () => {
    staffFindMany.mockResolvedValue([{ role: "SITE_ADMIN" }]);

    expect(await checkStaffPermission("user-1", "manage_staff")).toBe(true);
  });

  it("denies when the user has no staff roles", async () => {
    staffFindMany.mockResolvedValue([]);

    expect(await checkStaffPermission("user-1", "manage_staff")).toBe(false);
  });
});
