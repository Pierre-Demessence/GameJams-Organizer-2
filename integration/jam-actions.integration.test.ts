import { describe, it, expect } from "vitest";
import { updateJamAction, softDeleteJamAction } from "@/app/jams/actions";
import {
  assignRoleAction,
  removeRoleAction,
} from "@/app/jams/[slug]/manage/actions";
import { db } from "@/lib/db";
import { actingAs, signOut } from "./current-session";
import {
  createUser,
  createJam,
  grantJamRole,
  grantStaffRole,
  jamFormData,
} from "./factories";

describe("updateJamAction authorization", () => {
  it("rejects a signed-out user", async () => {
    const owner = await createUser();
    const jam = await createJam(owner.id);
    signOut();

    const res = await updateJamAction(jam.id, jamFormData());

    expect(res.error).toMatch(/signed in/i);
  });

  it("rejects a non-member", async () => {
    const owner = await createUser();
    const jam = await createJam(owner.id);
    const outsider = await createUser();
    actingAs(outsider.id);

    const res = await updateJamAction(jam.id, jamFormData());

    expect(res.error).toMatch(/permission/i);
  });

  it("rejects a MODERATOR, who lacks edit_jam", async () => {
    const owner = await createUser();
    const jam = await createJam(owner.id);
    const mod = await createUser();
    await grantJamRole(jam.id, mod.id, "MODERATOR");
    actingAs(mod.id);

    const res = await updateJamAction(jam.id, jamFormData());

    expect(res.error).toMatch(/permission/i);
  });

  it("allows an ADMIN and persists the update", async () => {
    const admin = await createUser();
    const jam = await createJam(admin.id, { slug: "before" });
    await grantJamRole(jam.id, admin.id, "ADMIN");
    actingAs(admin.id);

    const res = await updateJamAction(
      jam.id,
      jamFormData({ name: "New Name", slug: "after" })
    );

    expect(res.success).toBe(true);
    const updated = await db.jam.findUnique({ where: { id: jam.id } });
    expect(updated?.name).toBe("New Name");
    expect(updated?.slug).toBe("after");
  });
});

describe("softDeleteJamAction authorization", () => {
  it("rejects a signed-out user", async () => {
    const owner = await createUser();
    const jam = await createJam(owner.id);
    signOut();

    const res = await softDeleteJamAction(jam.id);

    expect(res.error).toMatch(/signed in/i);
    const stillThere = await db.jam.findUnique({ where: { id: jam.id } });
    expect(stillThere?.deletedAt).toBeNull();
  });

  it("rejects a non-member and leaves the jam intact", async () => {
    const owner = await createUser();
    const jam = await createJam(owner.id);
    const outsider = await createUser();
    actingAs(outsider.id);

    const res = await softDeleteJamAction(jam.id);

    expect(res.error).toMatch(/permission/i);
    const stillThere = await db.jam.findUnique({ where: { id: jam.id } });
    expect(stillThere?.deletedAt).toBeNull();
  });

  it("allows a jam ADMIN (delete_jam) and soft-deletes", async () => {
    const admin = await createUser();
    const jam = await createJam(admin.id, { slug: "doomed" });
    await grantJamRole(jam.id, admin.id, "ADMIN");
    actingAs(admin.id);

    const res = await softDeleteJamAction(jam.id);

    expect(res.success).toBe(true);
    const deleted = await db.jam.findUnique({ where: { id: jam.id } });
    expect(deleted?.deletedAt).not.toBeNull();
    expect(deleted?.slug).toContain("__del__");
  });

  it("allows a SITE_ADMIN staff member and records an audit entry", async () => {
    const owner = await createUser();
    const jam = await createJam(owner.id);
    const staff = await createUser();
    await grantStaffRole(staff.id);
    actingAs(staff.id);

    const res = await softDeleteJamAction(jam.id);

    expect(res.success).toBe(true);
    const audits = await db.auditLogEntry.findMany({
      where: { action: "jam:soft_delete", targetId: jam.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].actorId).toBe(staff.id);
  });
});

describe("role management authorization", () => {
  it("rejects assignRole from a non-ADMIN", async () => {
    const owner = await createUser();
    const jam = await createJam(owner.id);
    const mod = await createUser();
    await grantJamRole(jam.id, mod.id, "MODERATOR");
    await createUser("target");
    actingAs(mod.id);

    const res = await assignRoleAction(jam.id, "target", "JUDGE");

    expect(res.error).toMatch(/permission/i);
  });

  it("allows an ADMIN to assign a role", async () => {
    const admin = await createUser();
    const jam = await createJam(admin.id);
    await grantJamRole(jam.id, admin.id, "ADMIN");
    const target = await createUser("target");
    actingAs(admin.id);

    const res = await assignRoleAction(jam.id, "target", "JUDGE");

    expect(res.success).toBe(true);
    const roles = await db.jamRole.findMany({
      where: { jamId: jam.id, userId: target.id },
    });
    expect(roles.map((r) => r.role)).toContain("JUDGE");
  });

  it("prevents removing the creator's ADMIN role", async () => {
    const admin = await createUser();
    const jam = await createJam(admin.id);
    await grantJamRole(jam.id, admin.id, "ADMIN");
    const other = await createUser();
    await grantJamRole(jam.id, other.id, "ADMIN");
    actingAs(other.id);

    const res = await removeRoleAction(jam.id, admin.id, "ADMIN");

    expect(res.error).toMatch(/creator/i);
  });
});
