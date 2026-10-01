import type { JamPhase } from "@/domain/jam-phase";

export const SEARCH_MAX_QUERY = 100;
export const SEARCH_LIMIT = 6;

export interface SearchHit {
  slug: string;
  name: string;
  shortDesc: string;
  phase: JamPhase;
  publishedAt: Date | null;
}

// What people most likely want first: jams they can join or rate now.
const PHASE_RANK: Record<JamPhase, number> = { ONGOING: 0, RATING: 1, UPCOMING: 2, FINISHED: 3, DRAFT: 4 };

function matchRank(hit: SearchHit, q: string): number {
  const name = hit.name.toLowerCase();
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  if (name.includes(q)) return 3;
  return 4; // matched on the short description only
}

export function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX_QUERY);
}

export function rankSearchHits<T extends SearchHit>(hits: T[], rawQuery: string, limit = SEARCH_LIMIT): T[] {
  const q = normalizeQuery(rawQuery).toLowerCase();
  return [...hits]
    .sort(
      (a, b) =>
        matchRank(a, q) - matchRank(b, q) ||
        PHASE_RANK[a.phase] - PHASE_RANK[b.phase] ||
        (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
    )
    .slice(0, limit);
}
