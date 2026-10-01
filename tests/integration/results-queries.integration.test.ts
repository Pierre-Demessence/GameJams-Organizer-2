import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { loadResultsPage } from "@/lib/results-queries";
import { createJam, createSubmission, createUser, daysFromNow } from "./factories";

async function submitted(jamId: string, userId: string, title: string) {
  const s = await createSubmission(jamId, userId, { title });
  await db.submission.update({ where: { id: s.id }, data: { status: "SUBMITTED" } });
  return s;
}

describe("loadResultsPage", () => {
  it("joins ranked and excluded entries with their team and counts games rated", async () => {
    const owner = await createUser();
    const [a, b, c, rater] = [await createUser("ann"), await createUser(), await createUser(), await createUser()];
    await db.user.update({ where: { id: b.id }, data: { displayName: "Bea" } });
    const jam = await createJam(owner.id, {
      slug: "results-page", visibility: "PUBLIC", ranked: true, publishedAt: daysFromNow(-5),
      startDate: daysFromNow(-4), endDate: daysFromNow(-3), ratingEnd: daysFromNow(-1),
    });
    const fun = await db.criterion.create({ data: { jamId: jam.id, name: "Fun" } });
    const art = await db.criterion.create({ data: { jamId: jam.id, name: "Art" } });
    const sa = await submitted(jam.id, a.id, "A game");
    const sb = await submitted(jam.id, b.id, "B game");
    const sc = await submitted(jam.id, c.id, "C game");
    await db.submission.update({
      where: { id: sc.id },
      data: { competing: false, rateable: false, moderationReason: "Made before the jam" },
    });
    const rate = (submissionId: string, userId: string, score: number) =>
      Promise.all([fun, art].map((cr) => db.rating.create({ data: { submissionId, criterionId: cr.id, userId, score } })));
    await rate(sa.id, rater.id, 5);
    await rate(sa.id, b.id, 4);
    await rate(sb.id, rater.id, 2);
    await rate(sc.id, rater.id, 3);

    const page = await loadResultsPage(jam.id);
    expect(page.results.competing.map((r) => r.submissionId)).toEqual([sa.id, sb.id]);
    expect(page.results.notCompeting.map((r) => r.submissionId)).toEqual([sc.id]);
    expect(page.entries.get(sb.id)).toMatchObject({ title: "B game", team: ["Bea"], rateable: true });
    expect(page.entries.get(sc.id)).toMatchObject({ rateable: false, moderationReason: "Made before the jam" });
    expect(page.entries.get(sa.id)?.team).toEqual(["ann"]);
    // Four (rater, game) pairs, not eight per-criterion scores.
    expect(page.ratings).toBe(4);
  });

  it("drops hidden entries without re-ranking the others", async () => {
    const owner = await createUser();
    const [a, b, c, rater] = [await createUser(), await createUser(), await createUser(), await createUser()];
    const jam = await createJam(owner.id, {
      slug: "results-hidden", visibility: "PUBLIC", ranked: true, publishedAt: daysFromNow(-5),
      startDate: daysFromNow(-4), endDate: daysFromNow(-3), ratingEnd: daysFromNow(-1),
    });
    const fun = await db.criterion.create({ data: { jamId: jam.id, name: "Fun" } });
    const top = await submitted(jam.id, a.id, "Top");
    const second = await submitted(jam.id, b.id, "Second");
    const late = await submitted(jam.id, c.id, "Late");
    await db.submission.update({ where: { id: top.id }, data: { visible: false } });
    await db.submission.update({ where: { id: late.id }, data: { visible: false, competing: false } });
    for (const [s, score] of [[top, 5], [second, 3], [late, 4]] as const) {
      await db.rating.create({ data: { submissionId: s.id, criterionId: fun.id, userId: rater.id, score } });
    }

    const page = await loadResultsPage(jam.id);
    expect(page.results.competing.map((r) => [r.submissionId, r.rank])).toEqual([[second.id, 2]]);
    expect(page.results.notCompeting).toEqual([]);
    expect(page.entries.has(top.id)).toBe(false);
  });
});
