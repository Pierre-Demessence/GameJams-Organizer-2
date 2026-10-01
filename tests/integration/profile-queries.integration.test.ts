import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { loadProfile } from "@/lib/profile-queries";
import { createJam, createSubmission, createUser, daysFromNow, grantJamRole } from "./factories";

const FINISHED = {
  visibility: "PUBLIC" as const, ranked: true, publishedAt: daysFromNow(-6),
  startDate: daysFromNow(-5), endDate: daysFromNow(-3), ratingEnd: daysFromNow(-1),
};

async function submitted(jamId: string, userId: string, title: string) {
  const s = await createSubmission(jamId, userId, { title });
  await db.submission.update({ where: { id: s.id }, data: { status: "SUBMITTED" } });
  return s;
}

describe("loadProfile", () => {
  it("returns null for an unknown username", async () => {
    expect(await loadProfile("nobody-here")).toBeNull();
  });

  it("lists public jams with roles, games with placements, and stats", async () => {
    const me = await createUser("mira");
    const owner = await createUser();
    const rival = await createUser();
    const rater = await createUser();
    const mate = await createUser();
    await db.user.update({ where: { id: mate.id }, data: { displayName: "Wren" } });

    const done = await createJam(owner.id, { ...FINISHED, slug: "done-jam", name: "Done Jam" });
    const hosted = await createJam(me.id, {
      slug: "hosted-jam", name: "Hosted Jam", visibility: "PUBLIC", publishedAt: daysFromNow(-1),
      startDate: daysFromNow(2), endDate: daysFromNow(4),
    });
    const unlisted = await createJam(owner.id, { ...FINISHED, slug: "secret-jam", visibility: "UNLISTED" });
    await db.jamParticipant.createMany({
      data: [done, unlisted].map((j) => ({ jamId: j.id, userId: me.id })),
    });
    await grantJamRole(done.id, me.id, "JUDGE");
    await grantJamRole(hosted.id, me.id, "ADMIN");
    await grantJamRole(hosted.id, me.id, "HOST");

    const fun = await db.criterion.create({ data: { jamId: done.id, name: "Fun" } });
    const mine = await submitted(done.id, me.id, "Drizzle");
    await db.submissionMember.create({ data: { submissionId: mine.id, userId: mate.id } });
    const theirs = await submitted(done.id, rival.id, "Other");
    await db.rating.createMany({
      data: [
        { submissionId: mine.id, criterionId: fun.id, userId: rater.id, score: 5 },
        { submissionId: theirs.id, criterionId: fun.id, userId: rater.id, score: 2 },
      ],
    });
    const hidden = await submitted(done.id, me.id, "Hidden one");
    await db.submission.update({ where: { id: hidden.id }, data: { visible: false } });
    await submitted(unlisted.id, me.id, "Secret game");

    const profile = (await loadProfile("mira"))!;
    expect(profile.jams).toEqual([
      { slug: "hosted-jam", name: "Hosted Jam", phase: "UPCOMING", role: "Admin · Host", dates: expect.any(String) },
      { slug: "done-jam", name: "Done Jam", phase: "FINISHED", role: "Participant · Judge", dates: expect.any(String) },
    ]);
    expect(profile.games).toEqual([
      {
        id: mine.id, title: "Drizzle", coverUrl: null, jam: { slug: "done-jam", name: "Done Jam" },
        // Ranks include hidden entries (see results-queries), so the count does too.
        team: "with Wren", placement: { label: "#1 of 3", highlight: true },
      },
    ]);
    expect(profile.stats).toEqual({ jamsJoined: 1, games: 1, organized: 1 });
  });

  it("hides placements until results are public", async () => {
    const me = await createUser("hush");
    const owner = await createUser();
    const jam = await createJam(owner.id, { ...FINISHED, slug: "hush-jam" });
    await db.jam.update({ where: { id: jam.id }, data: { hideResults: true } });
    await submitted(jam.id, me.id, "Quiet");

    const profile = (await loadProfile("hush"))!;
    expect(profile.games[0]).toMatchObject({ title: "Quiet", team: "solo", placement: null });
  });
});
