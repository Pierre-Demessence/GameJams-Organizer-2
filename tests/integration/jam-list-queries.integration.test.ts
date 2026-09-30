import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { jamPhase } from "@/domain/jam-phase";
import { loadJamList } from "@/lib/jam-list-queries";
import { parseJamListParams } from "@/lib/jam-list-params";
import { createJam, createUser, daysFromNow } from "./factories";

const pub = { visibility: "PUBLIC" as const, publishedAt: daysFromNow(-10) };

async function seedPhases(ownerId: string) {
  const upcoming = await createJam(ownerId, { ...pub, name: "Up", startDate: daysFromNow(1), endDate: daysFromNow(2) });
  const live = await createJam(ownerId, { ...pub, name: "Live", startDate: daysFromNow(-1), endDate: daysFromNow(1) });
  const rating = await createJam(ownerId, {
    ...pub, name: "Rate", ranked: true, startDate: daysFromNow(-3), endDate: daysFromNow(-1), ratingEnd: daysFromNow(2),
  });
  const done = await createJam(ownerId, {
    ...pub, name: "Done", ranked: true, startDate: daysFromNow(-5), endDate: daysFromNow(-4), ratingEnd: daysFromNow(-2),
  });
  const doneNoRatingEnd = await createJam(ownerId, {
    ...pub, name: "Done no rating end", ranked: true, startDate: daysFromNow(-5), endDate: daysFromNow(-4), ratingEnd: null,
  });
  const doneShowcase = await createJam(ownerId, {
    ...pub, name: "Showcase", ranked: false, startDate: daysFromNow(-5), endDate: daysFromNow(-4),
  });
  return { upcoming, live, rating, done, doneNoRatingEnd, doneShowcase };
}

describe("loadJamList", () => {
  it("filters each status exactly like jamPhase()", async () => {
    const owner = await createUser();
    const jams = await seedPhases(owner.id);
    await createJam(owner.id, { ...pub, name: "No dates" });

    for (const status of ["live", "upcoming", "rating", "finished"] as const) {
      const list = await loadJamList(parseJamListParams({ status }));
      for (const jam of list.jams) {
        const row = await db.jam.findUniqueOrThrow({ where: { id: jam.id } });
        expect(jam.phase).toBe(jamPhase(row));
      }
    }
    const finished = await loadJamList(parseJamListParams({ status: "finished" }));
    expect(finished.jams.map((j) => j.id).sort()).toEqual(
      [jams.done.id, jams.doneNoRatingEnd.id, jams.doneShowcase.id].sort()
    );
    const all = await loadJamList(parseJamListParams({}));
    expect(all.jams.map((j) => j.name)).not.toContain("No dates");
    expect(all.counts).toEqual({ all: 6, live: 1, upcoming: 1, rating: 1, finished: 3 });
  });

  it("orders the relevant view live, upcoming, rating, finished", async () => {
    const owner = await createUser();
    await seedPhases(owner.id);
    const all = await loadJamList(parseJamListParams({}));
    expect(all.jams.map((j) => j.phase).slice(0, 3)).toEqual(["ONGOING", "UPCOMING", "RATING"]);
  });

  it("applies search, tag and format filters to the list and the counts", async () => {
    const owner = await createUser();
    await seedPhases(owner.id);
    const tagged = await createJam(owner.id, {
      ...pub, name: "Pixel Pumpkin", startDate: daysFromNow(3), endDate: daysFromNow(4),
    });
    await db.jam.update({ where: { id: tagged.id }, data: { tags: ["Pixel art"] } });

    const byQuery = await loadJamList(parseJamListParams({ q: "pumpkin" }));
    expect(byQuery.jams.map((j) => j.id)).toEqual([tagged.id]);
    expect(byQuery.counts.all).toBe(1);

    const byTag = await loadJamList(parseJamListParams({ tag: "Pixel art" }));
    expect(byTag.jams.map((j) => j.id)).toEqual([tagged.id]);

    const showcase = await loadJamList(parseJamListParams({ format: "showcase" }));
    expect(showcase.jams.every((j) => !j.ranked)).toBe(true);

    expect((await loadJamList(parseJamListParams({}))).tags).toContain("Pixel art");
  });

  it("pages with show and reports hasMore", async () => {
    const owner = await createUser();
    for (let i = 0; i < 25; i++) {
      await createJam(owner.id, { ...pub, startDate: daysFromNow(1 + i), endDate: daysFromNow(2 + i) });
    }
    const first = await loadJamList(parseJamListParams({}));
    expect(first.jams).toHaveLength(24);
    expect(first.hasMore).toBe(true);
    const second = await loadJamList(parseJamListParams({ show: "48" }));
    expect(second.jams).toHaveLength(25);
    expect(second.hasMore).toBe(false);
  });
});
