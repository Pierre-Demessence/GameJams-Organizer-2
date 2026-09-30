import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { loadJamPage } from "@/lib/jam-page-queries";
import { createJam, createSubmission, createUser, daysFromNow, grantJamRole, joinJam } from "./factories";

describe("loadJamPage", () => {
  it("returns null for unknown slugs and hides drafts from non-organizers", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const draft = await createJam(owner.id, { slug: "secret-draft" });
    await grantJamRole(draft.id, owner.id, "ADMIN");

    expect(await loadJamPage("does-not-exist", null)).toBeNull();
    expect(await loadJamPage("secret-draft", null)).toBeNull();
    expect(await loadJamPage("secret-draft", outsider.id)).toBeNull();
    const asOwner = await loadJamPage("secret-draft", owner.id);
    expect(asOwner?.phase).toBe("DRAFT");
    expect(asOwner?.viewer.canEditJam).toBe(true);
  });

  it("describes the viewer: joined, entry, permissions", async () => {
    const owner = await createUser();
    const player = await createUser();
    const jam = await createJam(owner.id, {
      slug: "live-jam", visibility: "PUBLIC", publishedAt: daysFromNow(-2),
      startDate: daysFromNow(-1), endDate: daysFromNow(1),
    });
    await joinJam(jam.id, player.id);
    const sub = await createSubmission(jam.id, player.id);

    const page = await loadJamPage("live-jam", player.id);
    expect(page?.phase).toBe("ONGOING");
    expect(page?.viewer).toMatchObject({
      hasJoined: true,
      submission: { id: sub.id, status: "DRAFT" },
      canEditJam: false,
      canModerate: false,
    });
    const anon = await loadJamPage("live-jam", null);
    expect(anon?.viewer).toMatchObject({ userId: null, hasJoined: false, submission: null });
  });

  it("ignores deleted submissions when finding the viewer's entry", async () => {
    const owner = await createUser();
    const jam = await createJam(owner.id, {
      slug: "deleted-entry", visibility: "PUBLIC", publishedAt: daysFromNow(-2),
      startDate: daysFromNow(-1), endDate: daysFromNow(1),
    });
    const sub = await createSubmission(jam.id, owner.id);
    await db.submission.update({ where: { id: sub.id }, data: { deletedAt: new Date() } });
    expect((await loadJamPage("deleted-entry", owner.id))?.viewer.submission).toBeNull();
  });
});
