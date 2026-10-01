import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { loadManageSubmissions } from "@/lib/manage-queries";
import { createOngoingJam, createSubmission, createUser } from "./factories";

describe("loadManageSubmissions", () => {
  it("lists drafts and hidden entries, skips deleted ones, and counts raters", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const [a, b, c, rater] = [await createUser(), await createUser(), await createUser(), await createUser()];
    const live = await createSubmission(jam.id, a.id, { title: "Live" });
    const draft = await createSubmission(jam.id, b.id, { title: "Draft" });
    const gone = await createSubmission(jam.id, c.id, { title: "Gone" });
    await db.submission.update({ where: { id: live.id }, data: { status: "SUBMITTED", visible: false } });
    await db.submission.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
    const crit = await db.criterion.create({ data: { jamId: jam.id, name: "Fun" } });
    await db.rating.create({ data: { submissionId: live.id, criterionId: crit.id, userId: rater.id, score: 4 } });

    const rows = await loadManageSubmissions(jam.id);
    expect(rows.map((r) => [r.title, r.status, r.visible, r.raters])).toEqual([
      ["Live", "SUBMITTED", false, 1],
      ["Draft", "DRAFT", true, null],
    ]);
    expect(rows.find((r) => r.id === draft.id)?.team).toHaveLength(1);
  });
});
