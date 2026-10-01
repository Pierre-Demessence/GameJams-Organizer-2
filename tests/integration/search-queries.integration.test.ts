import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { searchJams } from "@/lib/search-queries";
import { createJam, createUser, daysFromNow } from "./factories";

const LIVE = { visibility: "PUBLIC" as const, publishedAt: daysFromNow(-2), startDate: daysFromNow(-1), endDate: daysFromNow(1) };

describe("searchJams", () => {
  it("finds listed jams by name, description or tag, and nothing else", async () => {
    const owner = await createUser();
    await createJam(owner.id, { ...LIVE, slug: "kite-jam", name: "Kite Jam" });
    const byTag = await createJam(owner.id, { ...LIVE, slug: "wind-week", name: "Wind Week" });
    await db.jam.update({ where: { id: byTag.id }, data: { tags: ["kite"] } });
    await createJam(owner.id, { ...LIVE, slug: "secret-kite", name: "Secret Kite", visibility: "UNLISTED" });
    await createJam(owner.id, { slug: "draft-kite", name: "Draft Kite" });

    const hits = await searchJams("  KITE ");
    expect(hits.map((h) => h.slug)).toEqual(["kite-jam", "wind-week"]);
    expect(hits[0]).toEqual({ slug: "kite-jam", name: "Kite Jam", shortDesc: "Short description", phase: "ONGOING" });
  });

  it("returns nothing for a blank query", async () => {
    expect(await searchJams("   ")).toEqual([]);
  });

  it("skips deleted jams, matches descriptions, and keeps old exact matches", async () => {
    const owner = await createUser();
    const gone = await createJam(owner.id, { ...LIVE, slug: "gone-comet", name: "Comet Gone" });
    await db.jam.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
    const described = await createJam(owner.id, { ...LIVE, slug: "night-sky", name: "Night Sky" });
    await db.jam.update({ where: { id: described.id }, data: { shortDesc: "Build a comet catcher" } });
    // An old exact match, crowded out of the newest-40 window by newer description matches.
    await createJam(owner.id, { ...LIVE, slug: "comet", name: "Comet", publishedAt: daysFromNow(-30) });
    for (let i = 0; i < 41; i++) {
      const j = await createJam(owner.id, { ...LIVE, slug: `filler-${i}`, name: `Filler ${i}` });
      await db.jam.update({ where: { id: j.id }, data: { shortDesc: "about a comet" } });
    }

    const hits = await searchJams("comet");
    expect(hits[0].slug).toBe("comet");
    expect(hits.some((h) => h.slug === "gone-comet")).toBe(false);
    expect(await searchJams("catcher")).toEqual([expect.objectContaining({ slug: "night-sky" })]);
  });
});
