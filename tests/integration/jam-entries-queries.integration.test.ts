import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { loadJamPage } from "@/lib/jam-page-queries";
import { loadJamEntries } from "@/lib/jam-entries-queries";
import { parseEntriesParams } from "@/lib/jam-entries";
import { createJam, createSubmission, createUser, daysFromNow, grantJamRole } from "./factories";

async function submitted(jamId: string, userId: string, title: string, platforms: ("WEB" | "WINDOWS")[] = []) {
  const s = await createSubmission(jamId, userId, { title });
  await db.submission.update({ where: { id: s.id }, data: { status: "SUBMITTED", supportedPlatforms: platforms } });
  return s;
}

describe("loadJamEntries", () => {
  it("withholds the list while ONGOING when hideSubmissionsBeforeEnd is on, except for team and moderators", async () => {
    const owner = await createUser();
    const player = await createUser();
    const mod = await createUser();
    const jam = await createJam(owner.id, {
      slug: "hidden-list", visibility: "PUBLIC", publishedAt: daysFromNow(-2),
      startDate: daysFromNow(-1), endDate: daysFromNow(1),
    });
    await db.jam.update({ where: { id: jam.id }, data: { hideSubmissionsBeforeEnd: true } });
    await grantJamRole(jam.id, mod.id, "MODERATOR");
    const rival = await createUser();
    await submitted(jam.id, player.id, "Mine");
    await submitted(jam.id, rival.id, "Theirs");

    const params = parseEntriesParams({}, "ONGOING");
    const anon = await loadJamEntries((await loadJamPage("hidden-list", null))!, params);
    expect(anon).toMatchObject({ hidden: true, ownOnly: false, entries: [] });
    // A team sees its own entry, never the other teams' (spec §4.2).
    const team = await loadJamEntries((await loadJamPage("hidden-list", player.id))!, params);
    expect(team).toMatchObject({ hidden: false, ownOnly: true });
    expect(team.entries.map((e) => e.title)).toEqual(["Mine"]);
    const asMod = await loadJamEntries((await loadJamPage("hidden-list", mod.id))!, params);
    expect(asMod.ownOnly).toBe(false);
    expect(asMod.entries).toHaveLength(2);
  });

  it("counts distinct raters, marks the viewer's ratings and computes progress and next", async () => {
    const owner = await createUser();
    const [a, b, c] = [await createUser(), await createUser(), await createUser()];
    const jam = await createJam(owner.id, {
      slug: "rating-jam-x", visibility: "PUBLIC", ranked: true, publishedAt: daysFromNow(-4),
      startDate: daysFromNow(-3), endDate: daysFromNow(-1), ratingEnd: daysFromNow(2),
      ratingEligibility: "SUBMITTERS_AND_CONTRIBUTORS",
    });
    const fun = await db.criterion.create({ data: { jamId: jam.id, name: "Fun" } });
    const art = await db.criterion.create({ data: { jamId: jam.id, name: "Art" } });
    const sa = await submitted(jam.id, a.id, "A game", ["WEB"]);
    const sb = await submitted(jam.id, b.id, "B game", ["WINDOWS"]);
    const sc = await submitted(jam.id, c.id, "C game", ["WEB"]);
    // b rated A on two criteria: still one rater.
    for (const cr of [fun, art]) await db.rating.create({ data: { submissionId: sa.id, criterionId: cr.id, userId: b.id, score: 4 } });
    await db.rating.create({ data: { submissionId: sc.id, criterionId: fun.id, userId: a.id, score: 3 } });

    const pageA = (await loadJamPage("rating-jam-x", a.id))!;
    const res = await loadJamEntries(pageA, parseEntriesParams({}, "RATING"));
    const byTitle = Object.fromEntries(res.entries.map((e) => [e.title, e]));
    expect(byTitle["A game"]).toMatchObject({ raters: 1, isViewerTeam: true, eligible: false });
    expect(byTitle["C game"]).toMatchObject({ raters: 1, ratedByViewer: true });
    expect(res.progress).toEqual({ rated: 1, eligible: 2, next: sb.id });

    const webOnly = await loadJamEntries(pageA, parseEntriesParams({ platforms: "web", hideRated: "1" }, "RATING"));
    expect(webOnly.entries.map((e) => e.title)).toEqual(["A game"]);

    const anon = await loadJamEntries((await loadJamPage("rating-jam-x", null))!, parseEntriesParams({}, "RATING"));
    expect(anon.progress).toBeNull();
    expect(anon.entries.every((e) => !e.ratedByViewer)).toBe(true);
  });
});
