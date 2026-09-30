import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { loadHomeData } from "@/lib/home-queries";
import { createJam, createSubmission, createUser, daysFromNow } from "./factories";

async function rate(submissionId: string, criterionId: string, userId: string, score: number) {
  await db.rating.create({ data: { submissionId, criterionId, userId, score } });
}

describe("loadHomeData", () => {
  it("lists only published, public, non-deleted jams", async () => {
    const owner = await createUser();
    await createJam(owner.id, { visibility: "PUBLIC", startDate: daysFromNow(1), endDate: daysFromNow(2) });
    await createJam(owner.id, {
      visibility: "UNLISTED", publishedAt: daysFromNow(-1), startDate: daysFromNow(1), endDate: daysFromNow(2),
    });
    const deleted = await createJam(owner.id, {
      visibility: "PUBLIC", publishedAt: daysFromNow(-1), startDate: daysFromNow(1), endDate: daysFromNow(2),
    });
    await db.jam.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    expect(await loadHomeData()).toEqual({ live: [], upcoming: [], finished: [] });
  });

  it("orders live and rating jams by their next deadline", async () => {
    const owner = await createUser();
    const rating = await createJam(owner.id, {
      visibility: "PUBLIC", ranked: true, publishedAt: daysFromNow(-3), startDate: daysFromNow(-2),
      endDate: daysFromNow(-1), ratingEnd: daysFromNow(2),
    });
    const live = await createJam(owner.id, {
      visibility: "PUBLIC", publishedAt: daysFromNow(-2), startDate: daysFromNow(-1), endDate: daysFromNow(1),
    });
    const data = await loadHomeData();
    expect(data.live.map((j) => [j.id, j.phase])).toEqual([
      [live.id, "ONGOING"],
      [rating.id, "RATING"],
    ]);
  });

  it("hides the podium until results are public, then shows rated visible entries", async () => {
    const owner = await createUser();
    const [r1, r2] = [await createUser(), await createUser()];
    const jam = await createJam(owner.id, {
      visibility: "PUBLIC", ranked: true, publishedAt: daysFromNow(-5), startDate: daysFromNow(-4),
      endDate: daysFromNow(-3), ratingEnd: daysFromNow(-1),
    });
    const criterion = await db.criterion.create({ data: { jamId: jam.id, name: "Fun" } });
    const best = await createSubmission(jam.id, owner.id, { title: "Best" });
    const good = await createSubmission(jam.id, r1.id, { title: "Good" });
    const hidden = await createSubmission(jam.id, r2.id, { title: "Hidden" });
    await db.submission.updateMany({
      where: { id: { in: [best.id, good.id, hidden.id] } },
      data: { status: "SUBMITTED" },
    });
    await db.submission.update({ where: { id: hidden.id }, data: { visible: false } });
    await rate(best.id, criterion.id, r1.id, 5);
    await rate(best.id, criterion.id, r2.id, 5);
    await rate(good.id, criterion.id, r2.id, 3);
    await rate(hidden.id, criterion.id, r1.id, 5);
    await rate(hidden.id, criterion.id, owner.id, 5);
    await db.jam.update({ where: { id: jam.id }, data: { hideResults: true } });

    const before = await loadHomeData();
    expect(before.finished.map((j) => j.id)).toEqual([jam.id]);
    expect(before.finished[0].podium).toBeNull();

    await db.jam.update({ where: { id: jam.id }, data: { resultsRevealedAt: new Date() } });
    const after = await loadHomeData();
    expect(after.finished[0].podium?.map((p) => p.title)).toEqual(["Best", "Good"]);
    expect(after.finished[0].podium?.map((p) => p.place)).toEqual([1, 2]);
    expect(after.finished[0].ratings).toBe(5);
  });
});
