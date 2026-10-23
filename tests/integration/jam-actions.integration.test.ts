import { describe, it, expect } from "vitest";
import { leaveJamAction, updateJamAction, softDeleteJamAction } from "@/app/jams/actions";
import {
  assignRoleAction,
  removeRoleAction,
} from "@/app/jams/[slug]/manage/actions";
import { db } from "@/lib/db";
import { actingAs, signOut } from "./current-session";
import {
  createInvite,
  createOngoingJam,
  createSubmission,
  createUser,
  createJam,
  grantJamRole,
  grantStaffRole,
  jamFormData,
  joinJam,
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
    expect(await db.jam.findUnique({ where: { id: jam.id } })).toBeNull();
    const deleted = await db.jam.findFirst({
      where: { id: jam.id, deletedAt: { not: null } },
    });
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

describe("leaveJamAction", () => {
  it("removes the participant row and the user's pending invites in that jam only", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const elsewhere = await createOngoingJam(owner.id);
    const leader = await createUser();
    const user = await createUser();
    for (const j of [jam, elsewhere]) {
      await joinJam(j.id, leader.id);
      await joinJam(j.id, user.id);
    }
    const here = await createSubmission(jam.id, leader.id);
    const there = await createSubmission(elsewhere.id, leader.id);
    await createInvite(here.id, user.id, leader.id);
    await createInvite(there.id, user.id, leader.id);
    actingAs(user.id);

    const res = await leaveJamAction(jam.id);

    expect(res.success).toBe(true);
    expect(await db.jamParticipant.count({ where: { jamId: jam.id, userId: user.id } })).toBe(0);
    expect(await db.jamParticipant.count({ where: { jamId: elsewhere.id, userId: user.id } })).toBe(1);
    expect(await db.submissionInvite.count({ where: { submissionId: here.id } })).toBe(0);
    expect(await db.submissionInvite.count({ where: { submissionId: there.id } })).toBe(1);
  });

  it("refuses a user in a live submission with the canLeaveJam reason", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const user = await createUser();
    await joinJam(jam.id, user.id);
    await createSubmission(jam.id, user.id);
    actingAs(user.id);

    expect((await leaveJamAction(jam.id)).error).toMatch(/leave your submission/i);
    expect(await db.jamParticipant.count({ where: { jamId: jam.id, userId: user.id } })).toBe(1);
  });

  it("lets a user whose submission was deleted leave", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const user = await createUser();
    await joinJam(jam.id, user.id);
    const submission = await createSubmission(jam.id, user.id);
    await db.submission.update({ where: { id: submission.id }, data: { deletedAt: new Date() } });
    actingAs(user.id);

    expect((await leaveJamAction(jam.id)).success).toBe(true);
  });

  it("rejects signed-out users, users who never joined and unknown jams", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const user = await createUser();

    signOut();
    expect((await leaveJamAction(jam.id)).error).toMatch(/signed in/i);
    actingAs(user.id);
    expect((await leaveJamAction(jam.id)).error).toMatch(/not joined/i);
    expect((await leaveJamAction("missing")).error).toMatch(/not found/i);
  });

  it("is rate-limited", async () => {
    const user = await createUser();
    actingAs(user.id);

    const results = [];
    for (let i = 0; i < 11; i++) results.push(await leaveJamAction("missing"));

    expect(results[9].error).not.toMatch(/too many/i);
    expect(results[10].error).toMatch(/too many/i);
  });
});
