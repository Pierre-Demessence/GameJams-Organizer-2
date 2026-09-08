import { describe, it, expect } from "vitest";
import { hasPermission } from "@/lib/permissions";

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
