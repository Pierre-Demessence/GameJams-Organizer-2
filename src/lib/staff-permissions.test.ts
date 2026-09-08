import { describe, it, expect } from "vitest";
import { hasStaffPermission } from "@/lib/staff-permissions";

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
