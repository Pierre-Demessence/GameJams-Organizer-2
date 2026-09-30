import type { ListedPhase } from "@/lib/jam-phase-where";

export const JAM_LIST_PAGE_SIZE = 24;
export const JAM_LIST_MAX = 240;
const MAX_QUERY = 100;
const MAX_TAG = 40;

export type ListStatus = "all" | "live" | "upcoming" | "rating" | "finished";
export type ListFormat = "any" | "ranked" | "showcase";
export type ListSort = "relevant" | "newest" | "joined";

export interface JamListParams {
  status: ListStatus;
  q: string;
  tag: string;
  format: ListFormat;
  sort: ListSort;
  show: number;
}

export const STATUS_PHASE: Record<Exclude<ListStatus, "all">, ListedPhase> = {
  live: "ONGOING",
  upcoming: "UPCOMING",
  rating: "RATING",
  finished: "FINISHED",
};

const STATUSES: ListStatus[] = ["all", "live", "upcoming", "rating", "finished"];
const FORMATS: ListFormat[] = ["any", "ranked", "showcase"];
const SORTS: ListSort[] = ["relevant", "newest", "joined"];

type Raw = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function oneOf<T extends string>(value: string, allowed: T[], fallback: T): T {
  return (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function parseShow(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= JAM_LIST_PAGE_SIZE) return JAM_LIST_PAGE_SIZE;
  const pages = Math.ceil(n / JAM_LIST_PAGE_SIZE);
  return Math.min(JAM_LIST_MAX, pages * JAM_LIST_PAGE_SIZE);
}

export function parseJamListParams(raw: Raw): JamListParams {
  return {
    status: oneOf(first(raw.status), STATUSES, "all"),
    q: first(raw.q).trim().slice(0, MAX_QUERY),
    tag: first(raw.tag).trim().slice(0, MAX_TAG),
    format: oneOf(first(raw.format), FORMATS, "any"),
    sort: oneOf(first(raw.sort), SORTS, "relevant"),
    show: parseShow(first(raw.show)),
  };
}

// Any filter change starts again from the first page; only an explicit `show` keeps paging.
export function jamListHref(params: JamListParams, change: Partial<JamListParams> = {}): string {
  const next = { ...params, ...change };
  if (!("show" in change)) next.show = JAM_LIST_PAGE_SIZE;
  const qs = new URLSearchParams();
  if (next.status !== "all") qs.set("status", next.status);
  if (next.q) qs.set("q", next.q);
  if (next.tag) qs.set("tag", next.tag);
  if (next.format !== "any") qs.set("format", next.format);
  if (next.sort !== "relevant") qs.set("sort", next.sort);
  if (next.show !== JAM_LIST_PAGE_SIZE) qs.set("show", String(next.show));
  const s = qs.toString();
  return s ? `/jams?${s}` : "/jams";
}

export function topTags(tagLists: string[][], n = 8): string[] {
  const counts = new Map<string, number>();
  for (const tags of tagLists) {
    for (const raw of tags) {
      const tag = raw.trim();
      if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([tag]) => tag);
}
