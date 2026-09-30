import { describe, it, expect } from "vitest";
import {
  createJamAction,
  joinJamAction,
  publishJamAction,
  updateJamAction,
} from "@/app/jams/actions";
import { createCriterionAction } from "@/app/jams/[slug]/edit/criterion-actions";
import {
  createSubmissionAction,
  manualVerifySubmissionAction,
  submitSubmissionAction,
} from "@/app/submissions/actions";
import { submitRatingAction } from "@/app/submissions/[id]/rate/actions";
import { revealResultsAction } from "@/app/jams/[slug]/results/actions";
import { loadJamResults } from "@/lib/scoring";
import { db } from "@/lib/db";
import { jamPhase } from "@/domain/jam-phase";
import { resultsAccess } from "@/domain/results";
import { actingAs } from "./current-session";
import {
  createUser,
  daysFromNow,
  grantJamRole,
  jamFormData,
  submissionFormData,
} from "./factories";

// Phases derive from the clock, so the test moves the jam's dates instead of
// faking time (fake timers would also stall the Postgres driver).
async function moveJamTo(jamId: string, phase: "ONGOING" | "RATING" | "FINISHED") {
  const offsets = {
    ONGOING: { start: -1, end: 1, ratingEnd: 2 },
    RATING: { start: -2, end: -1, ratingEnd: 1 },
    FINISHED: { start: -3, end: -2, ratingEnd: -1 },
  }[phase];
  await db.jam.update({
    where: { id: jamId },
    data: {
      startDate: daysFromNow(offsets.start),
      endDate: daysFromNow(offsets.end),
      ratingEnd: daysFromNow(offsets.ratingEnd),
    },
  });
}

function rankedJamForm(overrides?: Record<string, string>) {
  return jamFormData({
    slug: "lifecycle-jam",
    ranked: "true",
    hideResults: "true",
    visibility: "UNLISTED",
    startDate: daysFromNow(-1).toISOString(),
    endDate: daysFromNow(1).toISOString(),
    ratingEnd: daysFromNow(2).toISOString(),
    ...overrides,
  });
}

function criterionForm(name: string, weight: string) {
  const fd = new FormData();
  fd.set("name", name);
  fd.set("weight", weight);
  return fd;
}

async function enterGame(jamId: string, slug: string, userId: string, title: string) {
  actingAs(userId);
  expect((await joinJamAction(jamId)).success).toBe(true);
  const created = await createSubmissionAction(
    slug,
    submissionFormData({ title, itchUrl: `https://${title.toLowerCase()}.itch.io/game` })
  );
  expect(created.success).toBe(true);
  return created.submissionId!;
}

async function rateAll(userId: string, submissionId: string, criterionIds: string[], score: number) {
  actingAs(userId);
  return submitRatingAction({
    submissionId,
    ratings: criterionIds.map((criterionId) => ({ criterionId, score })),
  });
}

describe("ranked jam lifecycle", () => {
  it("runs from draft to revealed results", async () => {
    const owner = await createUser("owner");
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const judge = await createUser("judge");
    const outsider = await createUser("outsider");

    // Draft: dates set, but not live and not joinable.
    actingAs(owner.id);
    const created = await createJamAction(rankedJamForm());
    expect(created.success).toBe(true);
    const jam = await db.jam.findUniqueOrThrow({ where: { slug: "lifecycle-jam" } });
    expect(jamPhase(jam)).toBe("DRAFT");

    actingAs(alice.id);
    expect((await joinJamAction(jam.id)).error).toMatch(/upcoming or ongoing/);

    // Publishing a ranked jam requires a criterion.
    actingAs(owner.id);
    expect((await publishJamAction(jam.id)).error).toMatch(/criterion/);
    expect((await createCriterionAction(jam.id, criterionForm("Fun", "1"))).success).toBe(true);
    expect((await createCriterionAction(jam.id, criterionForm("Art", "0"))).success).toBe(true);
    expect((await publishJamAction(jam.id)).success).toBe(true);

    const published = await db.jam.findUniqueOrThrow({ where: { id: jam.id } });
    expect(published.publishedAt).not.toBeNull();
    expect(published.visibility).toBe("UNLISTED");
    expect(jamPhase(published)).toBe("ONGOING");

    // A published jam cannot lose its schedule.
    const cleared = await updateJamAction(
      jam.id,
      rankedJamForm({ startDate: "", endDate: "", ratingEnd: "" })
    );
    expect(cleared.error).toMatch(/required/);

    await grantJamRole(jam.id, judge.id, "JUDGE");
    const aliceGame = await enterGame(jam.id, jam.slug, alice.id, "Alpha");
    const bobGame = await enterGame(jam.id, jam.slug, bob.id, "Beta");

    // Unverified entries stay DRAFT.
    actingAs(alice.id);
    expect((await submitSubmissionAction(aliceGame)).error).toMatch(/Verify ownership/);

    actingAs(owner.id);
    for (const id of [aliceGame, bobGame]) {
      expect((await manualVerifySubmissionAction(id)).success).toBe(true);
    }
    actingAs(alice.id);
    expect((await submitSubmissionAction(aliceGame)).success).toBe(true);
    actingAs(bob.id);
    expect((await submitSubmissionAction(bobGame)).success).toBe(true);

    // Rating period.
    await moveJamTo(jam.id, "RATING");
    const criteria = await db.criterion.findMany({ where: { jamId: jam.id } });
    const criterionIds = criteria.map((c) => c.id);

    expect((await rateAll(judge.id, aliceGame, criterionIds, 5)).success).toBe(true);
    expect((await rateAll(judge.id, bobGame, criterionIds, 2)).success).toBe(true);
    expect((await rateAll(alice.id, bobGame, criterionIds, 3)).success).toBe(true);
    expect((await rateAll(bob.id, aliceGame, criterionIds, 4)).success).toBe(true);
    expect((await rateAll(alice.id, aliceGame, criterionIds, 5)).error).toMatch(/own submission/);
    expect((await rateAll(outsider.id, aliceGame, criterionIds, 1)).error).toMatch(/not eligible/);

    const duringRating = await db.jam.findUniqueOrThrow({ where: { id: jam.id } });
    const ratingCtx = { ...duringRating, phase: jamPhase(duringRating) };
    expect(resultsAccess({ ...ratingCtx, canPreview: false })).toBe("none");
    expect(resultsAccess({ ...ratingCtx, canPreview: true })).toBe("preview");

    actingAs(owner.id);
    expect((await revealResultsAction(jam.id)).error).toMatch(/finished/);

    // Finished, but results stay hidden until revealed.
    await moveJamTo(jam.id, "FINISHED");
    const finished = await db.jam.findUniqueOrThrow({ where: { id: jam.id } });
    expect(resultsAccess({ ...finished, phase: jamPhase(finished), canPreview: false })).toBe(
      "none"
    );

    const results = await loadJamResults(jam.id);
    expect(results.competing.map((r) => [r.submissionId, r.rank])).toEqual([
      [aliceGame, 1],
      [bobGame, 2],
    ]);
    const art = criteria.find((c) => c.name === "Art")!;
    expect(results.competing[0].criteriaScores[art.id].rank).toBe(1);

    actingAs(alice.id);
    expect((await revealResultsAction(jam.id)).error).toMatch(/Not authorized/);
    actingAs(owner.id);
    expect((await revealResultsAction(jam.id)).success).toBe(true);

    const revealed = await db.jam.findUniqueOrThrow({ where: { id: jam.id } });
    expect(resultsAccess({ ...revealed, phase: jamPhase(revealed), canPreview: false })).toBe(
      "public"
    );
  });

  it("does not let members of draft submissions rate", async () => {
    const owner = await createUser();
    const rater = await createUser();
    const other = await createUser();

    actingAs(owner.id);
    await createJamAction(rankedJamForm({ slug: "draft-rater" }));
    const jam = await db.jam.findUniqueOrThrow({ where: { slug: "draft-rater" } });
    await createCriterionAction(jam.id, criterionForm("Fun", "1"));
    await publishJamAction(jam.id);

    await enterGame(jam.id, jam.slug, rater.id, "Unfinished");
    const target = await enterGame(jam.id, jam.slug, other.id, "Finished");
    actingAs(owner.id);
    await manualVerifySubmissionAction(target);
    actingAs(other.id);
    await submitSubmissionAction(target);

    await moveJamTo(jam.id, "RATING");
    const [criterion] = await db.criterion.findMany({ where: { jamId: jam.id } });
    const res = await rateAll(rater.id, target, [criterion.id], 4);
    expect(res.error).toMatch(/not eligible/);
  });
});
