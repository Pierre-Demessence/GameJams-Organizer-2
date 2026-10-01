import { db } from "@/lib/db";
import { jamPhase } from "@/domain/jam-phase";
import { LISTED_JAM } from "@/lib/jam-phase-where";
import { normalizeQuery, rankSearchHits, type SearchHit } from "@/lib/search";

// Ranking happens in JS over a bounded candidate set: enough for a quick-jump palette, while
// the full /jams page keeps the paged, filterable list.
const CANDIDATES = 40;

export async function searchJams(rawQuery: string, now = new Date()): Promise<Omit<SearchHit, "publishedAt">[]> {
  const q = normalizeQuery(rawQuery);
  if (!q) return [];
  const select = {
    slug: true, name: true, shortDesc: true, publishedAt: true, startDate: true, endDate: true,
    ratingEnd: true, ranked: true,
  } as const;
  // The broad match takes the newest candidates; the name-prefix match makes sure the best
  // matches are never crowded out by many newer, weaker ones.
  const [broad, prefix] = await Promise.all([
    db.jam.findMany({
      where: {
        AND: [
          LISTED_JAM,
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { shortDesc: { contains: q, mode: "insensitive" } },
              { tags: { has: q.toLowerCase() } },
            ],
          },
        ],
      },
      select,
      orderBy: { publishedAt: "desc" },
      take: CANDIDATES,
    }),
    db.jam.findMany({
      where: { AND: [LISTED_JAM, { name: { startsWith: q, mode: "insensitive" } }] },
      select,
      orderBy: { publishedAt: "desc" },
      take: CANDIDATES,
    }),
  ]);
  const rows = [...new Map([...prefix, ...broad].map((r) => [r.slug, r])).values()];
  const hits = rows.map((r) => ({
    slug: r.slug, name: r.name, shortDesc: r.shortDesc, publishedAt: r.publishedAt, phase: jamPhase(r, now),
  }));
  return rankSearchHits(hits, q).map((h) => ({ slug: h.slug, name: h.name, shortDesc: h.shortDesc, phase: h.phase }));
}
