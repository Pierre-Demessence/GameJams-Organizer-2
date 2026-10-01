import { describe, it, expect } from "vitest";
import { restoreJamAction, restoreSubmissionAction } from "@/app/admin/actions";
import { softDeleteJamAction } from "@/app/jams/actions";
import { deleteSubmissionAction } from "@/app/submissions/actions";
import { db } from "@/lib/db";
import { actingAs } from "./current-session";
import { createOngoingJam, createSubmission, createUser, grantStaffRole } from "./factories";

async function staff() {
  const admin = await createUser();
  await grantStaffRole(admin.id, "SITE_ADMIN");
  return admin;
}

describe("restore actions", () => {
  it("restores a deleted jam under its original slug, and audits it", async () => {
    const admin = await staff();
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id, { slug: "restore-me" });
    actingAs(admin.id);
    expect((await softDeleteJamAction(jam.id)).success).toBe(true);

    expect((await restoreJamAction(jam.id)).success).toBe(true);
    const back = await db.jam.findUnique({ where: { id: jam.id } });
    expect(back).toMatchObject({ slug: "restore-me", deletedAt: null });
    expect(await db.auditLogEntry.count({ where: { action: "jam:restore", targetId: jam.id } })).toBe(1);
  });

  it("refuses when the slug was reused, and refuses non-staff", async () => {
    const admin = await staff();
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id, { slug: "reused-slug" });
    actingAs(admin.id);
    await softDeleteJamAction(jam.id);
    await createOngoingJam(owner.id, { slug: "reused-slug" });

    expect((await restoreJamAction(jam.id)).error).toMatch(/Another jam now uses/);
    actingAs(owner.id);
    expect((await restoreJamAction(jam.id)).error).toMatch(/permission/);
  });

  it("restores a submission unless a member has joined another team", async () => {
    const admin = await staff();
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const [a, b] = [await createUser(), await createUser()];
    const first = await createSubmission(jam.id, a.id);
    const second = await createSubmission(jam.id, b.id);
    actingAs(admin.id);
    await deleteSubmissionAction(first.id);
    await deleteSubmissionAction(second.id);
    await createSubmission(jam.id, b.id);

    expect((await restoreSubmissionAction(first.id)).success).toBe(true);
    expect(await db.submission.findUnique({ where: { id: first.id } })).not.toBeNull();
    expect((await restoreSubmissionAction(second.id)).error).toMatch(/another submission/);
  });
});
