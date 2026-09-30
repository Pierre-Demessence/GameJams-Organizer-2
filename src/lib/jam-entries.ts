import type { JamPhase } from "@/domain/jam-phase";

export type Platform = "WINDOWS" | "MAC" | "LINUX" | "WEB";
export type EntriesSort = "fewest" | "newest" | "title";
export interface EntriesParams {
  platforms: Platform[];
  hideRated: boolean;
  sort: EntriesSort;
}
export interface QueueEntry {
  id: string;
  createdAt: Date;
  raters: number;
  eligible: boolean;
  ratedByViewer: boolean;
}

export const PLATFORMS: Platform[] = ["WINDOWS", "MAC", "LINUX", "WEB"];
type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// "Fewest ratings" only makes sense while rating is open, so it is the default then and
// unavailable otherwise.
function defaultSort(phase: JamPhase): EntriesSort {
  return phase === "RATING" ? "fewest" : "newest";
}

export function parseEntriesParams(raw: Raw, phase: JamPhase): EntriesParams {
  const rating = phase === "RATING";
  const platforms = [...new Set(first(raw.platforms).split(",").map((p) => p.trim().toUpperCase()))].filter(
    (p): p is Platform => (PLATFORMS as string[]).includes(p)
  );
  const sortRaw = first(raw.sort);
  const allowed: EntriesSort[] = rating ? ["fewest", "newest", "title"] : ["newest", "title"];
  const sort = (allowed as string[]).includes(sortRaw) ? (sortRaw as EntriesSort) : defaultSort(phase);
  return { platforms, hideRated: rating && first(raw.hideRated) === "1", sort };
}

// Every value comes from a fixed list (platform enums, `1`, sort names), so the query
// string is built by hand without escaping.
export function entriesHref(
  slug: string,
  phase: JamPhase,
  params: EntriesParams,
  change: Partial<EntriesParams> = {}
): string {
  const next = { ...params, ...change };
  const parts: string[] = [];
  if (next.platforms.length) parts.push(`platforms=${next.platforms.map((p) => p.toLowerCase()).join(",")}`);
  if (next.hideRated) parts.push("hideRated=1");
  if (next.sort !== defaultSort(phase)) parts.push(`sort=${next.sort}`);
  return `/jams/${slug}/submissions${parts.length ? `?${parts.join("&")}` : ""}`;
}

// Spec §6.6: serve the least-rated entries first so obscure games get coverage.
export function nextToRate(entries: QueueEntry[]): string | null {
  const open = entries.filter((e) => e.eligible && !e.ratedByViewer);
  open.sort((a, b) => a.raters - b.raters || a.createdAt.getTime() - b.createdAt.getTime());
  return open[0]?.id ?? null;
}
