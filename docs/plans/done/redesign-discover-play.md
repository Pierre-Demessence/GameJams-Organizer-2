# Redesign — Discover & Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the jam list, the jam page (overview), a new jam submissions tab and the
submission page in the approved dark-first design, on top of the foundations that are
already merged.

**Architecture:** Each page gets a database loader in `src/lib/*-queries.ts`
(integration-tested) and pure presentation helpers in `src/lib/*.ts` (unit-tested); pages and
components stay thin and use the existing tokens (`bg-card`, `text-live`, …) and jam
components (`JamStatusBadge`, `JamProgress`, `Countdown`). Phase filtering moves into SQL
through one shared `jamPhaseWhere()` so lists, counts and the homepage agree with
`jamPhase()`. The jam page and its new Submissions tab share one header, loaded once per
request through React `cache()`.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, Tailwind CSS 4, shadcn `base-nova`
on `@base-ui/react`, `next-auth` v5, Prisma 7, Vitest 5, Playwright.

**Spec:** Design canvas "GameJam Organizer — Website Design"
(<https://claude.ai/artifact/SPJeNxb9rsAiNeGNoeBXqB>, private to the owner). Boards: **Browse
jams**, **Jam — overview (live, joined)**, **Jam — submissions (rating)**, **Submission
page**, and their mobile versions **Browse jams — mobile**, **Jam page — mobile**,
**Submission — mobile**. Product rules: [product-spec.md](../../specs/product-spec.md). Design
tokens and components: [design-system.md](../../design-system.md).

**Scope:** The four screens above. Rating, results, profile, settings, sign-in and all
organizer screens stay as they are; they belong to later plans listed in
[backlog.md](../../backlog.md#redesign). The existing owner panel, team manager and moderation
actions on the submission page are kept as they are (they re-skin through the tokens) and are
redesigned with the organizer screens.

## Global Constraints

- Colors come only from the tokens in `src/app/globals.css` (see `docs/design-system.md`);
  never hard-code hex values in components.
- Jam status labels: Draft, Upcoming, **Live** (`ONGOING`), Rating, Finished — always through
  `jamStatus()` / `JamStatusBadge`.
- Fonts: Geist for text; Geist Mono (`font-mono`) for dates, countdowns, counts and scores.
- Dates shown to users are formatted in UTC and labelled "UTC" at least once per view.
- Touch targets are at least 44px on mobile (`min-h-11` / `size-11`); tap areas of adjacent
  links must not overlap.
- No emoji in UI chrome.
- Images are external URLs (spec §2): render them with `<img loading="lazy"
  referrerPolicy="no-referrer">`, always with `alt`, and fall back to the dotted placeholder
  when the URL is missing.
- User input from the URL (search, filters, paging) is validated and clamped before it reaches
  a query.
- Visibility rules are unchanged: draft jams only for organizers; hidden (`visible: false`)
  and draft submissions only for their team and moderators; `hideSubmissionsBeforeEnd` hides
  the list while `ONGOING` (moderators see all; a team sees only its own entry); private
  custom fields only for moderators.
- Ratings stay anonymous: no page reveals who rated what.

## Review Focus

1. **Phase filters match `jamPhase()`.** A ranked jam that ended with `ratingEnd` null is
   FINISHED; a published jam missing a date is DRAFT and never listed. Pinned by the
   integration tests in Task 2.
2. **Hostile query strings.** `?status=nope&show=99999&q=<5 000 chars>&format=x` must render
   the default list, not error and not run an unbounded query. Pinned by
   `parseJamListParams` tests in Task 2.
3. **Hidden submissions list.** With `hideSubmissionsBeforeEnd` on and the jam `ONGOING`, the
   Submissions tab shows the "hidden until the jam ends" state to outsiders, only their own
   entry to a team, and the full list to moderators. Pinned by the integration test in Task 6.
4. **Rate-next with nothing left.** When the viewer has rated every eligible entry (or none is
   eligible), the rating card says so and shows no "Rate next game" link. Pinned by
   `nextToRate` tests in Task 6.
5. **Signed-out and draft states on the jam page.** Signed-out visitors see "Sign in to join";
   a jam in DRAFT still 404s for non-organizers. Pinned by `entryPanelState` tests in Task 4
   and the loader integration test in Task 4.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/app/globals.css` | `no-scrollbar` utility |
| `src/lib/initials.ts` (+ test) | `initials(name)` |
| `src/lib/jam-labels.ts` (+ test) | Rating-eligibility, role and platform labels |
| `src/components/cover-image.tsx` | External image or dotted placeholder with initials |
| `src/components/link-tabs.tsx` | Link-based tab bar (`aria-current`) with scrolling on mobile |
| `src/lib/jam-phase-where.ts` | `jamPhaseWhere(phase, now)` + `LISTED_JAM` Prisma filters |
| `src/lib/jam-list-params.ts` (+ test) | Parse/serialise `/jams` search params, `topTags` |
| `src/lib/jam-list-queries.ts` | `loadJamList()` |
| `tests/integration/jam-list-queries.integration.test.ts` | Phase filters, counts, paging |
| `src/components/jam/jam-card.tsx` | Jam card for the list |
| `src/app/jams/jam-filters.tsx` | Client select controls (format, sort) |
| `src/app/jams/page.tsx` | Jam list page |
| `src/lib/jam-page.ts` (+ test) | `jamTimeline()`, `entryPanelState()` |
| `src/lib/jam-page-queries.ts` | `loadJamPage()` (React `cache`) |
| `tests/integration/jam-page-queries.integration.test.ts` | Draft visibility, viewer context |
| `src/components/jam/jam-timeline.tsx` | Labelled timeline with countdown |
| `src/app/jams/[slug]/jam-header.tsx` | Shared header (cover, title, actions, timeline, tabs) |
| `src/app/jams/[slug]/page.tsx`, `loading.tsx` | Overview tab |
| `src/app/jams/[slug]/jam-actions-client.tsx` | Join / Publish buttons (restyled) |
| `src/lib/jam-entries.ts` (+ test) | `parseEntriesParams()`, `nextToRate()` |
| `src/lib/jam-entries-queries.ts` | `loadJamEntries()` |
| `tests/integration/jam-entries-queries.integration.test.ts` | Hidden list, rating counts |
| `src/app/jams/[slug]/submissions/page.tsx` | Submissions tab |
| `src/app/jams/[slug]/submission-list.tsx` | Deleted (replaced by the tab) |
| `src/app/submissions/[id]/page.tsx`, `loading.tsx` | Submission page |
| `src/lib/home-queries.ts` | Reuses `LISTED_JAM` / `jamPhaseWhere` |

---

### Task 1: Shared primitives

**Files:**

- Modify: `src/app/globals.css`
- Create: `src/lib/initials.ts`, `src/lib/initials.test.ts`
- Create: `src/lib/jam-labels.ts`, `src/lib/jam-labels.test.ts`
- Create: `src/components/cover-image.tsx`
- Create: `src/components/link-tabs.tsx`
- Modify: `src/app/page.tsx` (use `initials()` instead of its inline expression)

**Interfaces:**

- Produces:
  - Tailwind utility `no-scrollbar`
  - `initials(name: string): string` — up to two uppercase letters; `"?"` for blank input
  - `ratingEligibilityLabel(e: RatingEligibility): string`
  - `jamRoleLabel(role: "ADMIN" | "MODERATOR" | "JUDGE" | "HOST"): string`
  - `platformLabel(p: "WINDOWS" | "MAC" | "LINUX" | "WEB"): string`
  - `<CoverImage src={string | null} alt={string} name={string} className? />`
  - `<LinkTabs label={string} tabs={{ href: string; label: string; count?: number; active: boolean }[]} />`

- [x] **Step 1: Write the failing tests**

`src/lib/initials.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { initials } from "@/lib/initials";

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Ashes & Embers Jam")).toBe("A&");
    expect(initials("tiny worlds")).toBe("TW");
  });
  it("uses two letters of a single word", () => {
    expect(initials("pixelmira")).toBe("PI");
  });
  it("ignores extra whitespace and handles blanks", () => {
    expect(initials("  One   Button ")).toBe("OB");
    expect(initials("   ")).toBe("?");
  });
});
```

`src/lib/jam-labels.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { jamRoleLabel, platformLabel, ratingEligibilityLabel } from "@/lib/jam-labels";

describe("jam labels", () => {
  it("names every rating audience in spec §6.1 terms", () => {
    expect(ratingEligibilityLabel("SUBMITTERS_ONLY")).toBe("Team leaders only");
    expect(ratingEligibilityLabel("SUBMITTERS_AND_CONTRIBUTORS")).toBe("All team members");
    expect(ratingEligibilityLabel("JUDGES_ONLY")).toBe("Judges only");
    expect(ratingEligibilityLabel("EVERYONE")).toBe("Everyone signed in");
  });
  it("names roles and platforms", () => {
    expect(jamRoleLabel("MODERATOR")).toBe("Moderator");
    expect(platformLabel("MAC")).toBe("Mac");
    expect(platformLabel("WEB")).toBe("Web");
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/initials.test.ts src/lib/jam-labels.test.ts`
Expected: FAIL — modules not found.

- [x] **Step 3: Implement the helpers**

`src/lib/initials.ts`:

```ts
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}
```

`src/lib/jam-labels.ts`:

```ts
import type { RatingEligibility } from "@/domain/rating";

const ELIGIBILITY: Record<RatingEligibility, string> = {
  SUBMITTERS_ONLY: "Team leaders only",
  SUBMITTERS_AND_CONTRIBUTORS: "All team members",
  JUDGES_ONLY: "Judges only",
  EVERYONE: "Everyone signed in",
};

export function ratingEligibilityLabel(e: RatingEligibility): string {
  return ELIGIBILITY[e];
}

const ROLES = { ADMIN: "Admin", MODERATOR: "Moderator", JUDGE: "Judge", HOST: "Host" } as const;

export function jamRoleLabel(role: keyof typeof ROLES): string {
  return ROLES[role];
}

const PLATFORMS = { WINDOWS: "Windows", MAC: "Mac", LINUX: "Linux", WEB: "Web" } as const;

export function platformLabel(p: keyof typeof PLATFORMS): string {
  return PLATFORMS[p];
}
```

- [x] **Step 4: Run to verify the tests pass**

Run: `pnpm test src/lib/initials.test.ts src/lib/jam-labels.test.ts` → PASS.

- [x] **Step 5: Add the `no-scrollbar` utility**

Append to `src/app/globals.css` (after the `@theme inline` block):

```css
@utility no-scrollbar {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
```

- [x] **Step 6: `CoverImage`**

```tsx
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

// Covers are external URLs (spec §2: no hosted assets); no-referrer keeps the viewer's
// page URL away from third-party image hosts.
export function CoverImage({
  src,
  alt,
  name,
  className,
}: {
  src: string | null;
  alt: string;
  name: string;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cn("object-cover", className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "flex items-center justify-center bg-muted bg-[radial-gradient(var(--input)_1px,transparent_1px)] [background-size:14px_14px] font-semibold text-subtle-foreground",
        className
      )}
    >
      <span aria-hidden>{initials(name)}</span>
    </div>
  );
}
```

- [x] **Step 7: `LinkTabs`**

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LinkTab {
  href: string;
  label: string;
  count?: number;
  active: boolean;
}

// Tabs are real links: each tab is its own URL, so the server renders the selected view.
export function LinkTabs({ label, tabs }: { label: string; tabs: LinkTab[] }) {
  return (
    <div className="relative -mx-4 md:mx-0">
      <nav
        aria-label={label}
        className="no-scrollbar flex gap-1 overflow-x-auto border-b px-4 md:px-0"
      >
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={cn(
              "-mb-px flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-sm transition-colors",
              t.active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="font-mono text-xs text-subtle-foreground">{t.count}</span>
            )}
          </Link>
        ))}
      </nav>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background md:hidden"
      />
    </div>
  );
}
```

- [x] **Step 8: Use `initials()` on the homepage**

In `src/app/page.tsx`, replace the inline initials expression in `LivePanel`
(`name.split(/\s+/)…toUpperCase()`) with `initials(jam.name)` and import it from
`@/lib/initials`.

- [x] **Step 9: Verify and commit**

Run: `pnpm test && pnpm lint && pnpm exec tsc --noEmit` → all pass.

```bash
git add src/app/globals.css src/lib/initials.ts src/lib/initials.test.ts src/lib/jam-labels.ts src/lib/jam-labels.test.ts src/components/cover-image.tsx src/components/link-tabs.tsx src/app/page.tsx
git commit -m "feat(ui): shared cover image, link tabs and label helpers"
```

---

### Task 2: Jam list data

**Files:**

- Create: `src/lib/jam-phase-where.ts`
- Create: `src/lib/jam-list-params.ts`, `src/lib/jam-list-params.test.ts`
- Create: `src/lib/jam-list-queries.ts`
- Create: `tests/integration/jam-list-queries.integration.test.ts`
- Modify: `src/lib/home-queries.ts` (use `LISTED_JAM` and `jamPhaseWhere`)
- Modify: `vitest.config.mts` (exclude `src/lib/jam-list-queries.ts` and
  `src/lib/jam-phase-where.ts` from unit coverage)

**Interfaces:**

- Produces:
  - `LISTED_JAM: Prisma.JamWhereInput` — not deleted, PUBLIC, published, both dates set
  - `type ListedPhase = "UPCOMING" | "ONGOING" | "RATING" | "FINISHED"`
  - `jamPhaseWhere(phase: ListedPhase, now: Date): Prisma.JamWhereInput`
  - `JAM_LIST_PAGE_SIZE = 24`, `JAM_LIST_MAX = 240`
  - `type ListStatus = "all" | "live" | "upcoming" | "rating" | "finished"`
  - `type ListFormat = "any" | "ranked" | "showcase"`
  - `type ListSort = "relevant" | "newest" | "joined"`
  - `interface JamListParams { status: ListStatus; q: string; tag: string; format: ListFormat; sort: ListSort; show: number }`
  - `parseJamListParams(raw: Record<string, string | string[] | undefined>): JamListParams`
  - `jamListHref(params: JamListParams, change?: Partial<JamListParams>): string`
  - `STATUS_PHASE: Record<Exclude<ListStatus, "all">, ListedPhase>`
  - `topTags(tagLists: string[][], n?: number): string[]`
  - `loadJamList(params: JamListParams, now?: Date): Promise<JamList>` where

```ts
export interface JamSummary {
  id: string;
  slug: string;
  name: string;
  shortDesc: string;
  coverUrl: string | null;
  tags: string[];
  ranked: boolean;
  phase: JamPhase;
  publishedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  ratingEnd: Date | null;
  joined: number;
  entries: number;
}
export interface JamList {
  jams: JamSummary[];
  counts: Record<ListStatus, number>;
  tags: string[];
  hasMore: boolean;
}
```

- [x] **Step 1: Write the failing unit tests**

`src/lib/jam-list-params.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  JAM_LIST_MAX,
  JAM_LIST_PAGE_SIZE,
  jamListHref,
  parseJamListParams,
  topTags,
} from "@/lib/jam-list-params";

const defaults = {
  status: "all",
  q: "",
  tag: "",
  format: "any",
  sort: "relevant",
  show: JAM_LIST_PAGE_SIZE,
};

describe("parseJamListParams", () => {
  it("returns defaults for an empty query", () => {
    expect(parseJamListParams({})).toEqual(defaults);
  });
  it("reads valid values", () => {
    expect(
      parseJamListParams({ status: "live", q: " pixel ", tag: "2D", format: "ranked", sort: "joined", show: "48" })
    ).toEqual({ status: "live", q: "pixel", tag: "2D", format: "ranked", sort: "joined", show: 48 });
  });
  it("falls back on unknown or hostile values", () => {
    const parsed = parseJamListParams({
      status: "nope",
      format: "x",
      sort: "drop table",
      show: "99999",
      q: "a".repeat(5000),
      tag: ["a", "b"],
    });
    expect(parsed.status).toBe("all");
    expect(parsed.format).toBe("any");
    expect(parsed.sort).toBe("relevant");
    expect(parsed.show).toBe(JAM_LIST_MAX);
    expect(parsed.q).toHaveLength(100);
    expect(parsed.tag).toBe("a");
  });
  it("rounds show up to a whole page and never below one page", () => {
    expect(parseJamListParams({ show: "25" }).show).toBe(48);
    expect(parseJamListParams({ show: "-3" }).show).toBe(JAM_LIST_PAGE_SIZE);
    expect(parseJamListParams({ show: "abc" }).show).toBe(JAM_LIST_PAGE_SIZE);
  });
});

describe("jamListHref", () => {
  it("omits defaults", () => {
    expect(jamListHref(parseJamListParams({}))).toBe("/jams");
  });
  it("applies changes and resets paging when filters change", () => {
    const current = parseJamListParams({ status: "live", show: "48", q: "cozy" });
    expect(jamListHref(current, { status: "finished" })).toBe("/jams?status=finished&q=cozy");
    expect(jamListHref(current, { show: 72 })).toBe("/jams?status=live&q=cozy&show=72");
  });
  it("encodes values", () => {
    expect(jamListHref(parseJamListParams({}), { tag: "Pixel art" })).toBe("/jams?tag=Pixel+art");
  });
});

describe("topTags", () => {
  it("orders by frequency, then alphabetically, and limits the count", () => {
    expect(topTags([["2D", "Cozy"], ["2D"], ["Horror", "Cozy"], ["3D"]], 3)).toEqual(["2D", "Cozy", "3D"]);
  });
  it("ignores blanks", () => {
    expect(topTags([["", " "], ["Audio"]])).toEqual(["Audio"]);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/jam-list-params.test.ts` → FAIL (module not found).

- [x] **Step 3: Implement `jam-list-params.ts`**

```ts
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
```

Run: `pnpm test src/lib/jam-list-params.test.ts` → PASS. (If the `"/jams?status=finished&q=cozy"`
expectation fails on parameter order, keep the implementation order status, q, tag, format,
sort, show — the test encodes it.)

- [x] **Step 4: Write the failing integration test**

`tests/integration/jam-list-queries.integration.test.ts`:

```ts
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
```

Run: `pnpm test:integration tests/integration/jam-list-queries.integration.test.ts` → FAIL
(module not found).

- [x] **Step 5: Implement `jam-phase-where.ts`**

```ts
import type { Prisma } from "@/generated/prisma/client";

export type ListedPhase = "UPCOMING" | "ONGOING" | "RATING" | "FINISHED";

// Mirrors jamPhase() in SQL. A published jam without both dates is DRAFT, so it is never
// listed; a ranked jam whose rating end is missing is FINISHED once its end date passes.
export const LISTED_JAM: Prisma.JamWhereInput = {
  deletedAt: null,
  visibility: "PUBLIC",
  publishedAt: { not: null },
  startDate: { not: null },
  endDate: { not: null },
};

export function jamPhaseWhere(phase: ListedPhase, now: Date): Prisma.JamWhereInput {
  switch (phase) {
    case "UPCOMING":
      return { startDate: { gt: now } };
    case "ONGOING":
      return { startDate: { lte: now }, endDate: { gt: now } };
    case "RATING":
      return { ranked: true, endDate: { lte: now }, ratingEnd: { gt: now } };
    case "FINISHED":
      return {
        endDate: { lte: now },
        OR: [{ ranked: false }, { ratingEnd: null }, { ratingEnd: { lte: now } }],
      };
  }
}
```

- [x] **Step 6: Implement `jam-list-queries.ts`**

```ts
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { jamPhase, type JamPhase } from "@/domain/jam-phase";
import { LISTED_JAM, jamPhaseWhere, type ListedPhase } from "@/lib/jam-phase-where";
import { STATUS_PHASE, topTags, type JamListParams, type ListStatus } from "@/lib/jam-list-params";

// JamSummary and JamList: exactly as in this task's Interfaces block.

const LIVE_SUBMISSIONS = { status: "SUBMITTED", visible: true, deletedAt: null } as const;
const SELECT = {
  id: true, slug: true, name: true, shortDesc: true, coverUrl: true, tags: true, ranked: true,
  publishedAt: true, startDate: true, endDate: true, ratingEnd: true,
  _count: { select: { participants: true, submissions: { where: LIVE_SUBMISSIONS } } },
} satisfies Prisma.JamSelect;

// Natural order inside each phase: what ends or starts soonest first, newest results first.
const PHASE_ORDER: Record<ListedPhase, Prisma.JamOrderByWithRelationInput> = {
  ONGOING: { endDate: "asc" },
  UPCOMING: { startDate: "asc" },
  RATING: { ratingEnd: "asc" },
  FINISHED: { endDate: "desc" },
};
const RELEVANT_PHASES: ListedPhase[] = ["ONGOING", "UPCOMING", "RATING", "FINISHED"];

function baseWhere(p: JamListParams): Prisma.JamWhereInput {
  const and: Prisma.JamWhereInput[] = [LISTED_JAM];
  if (p.q) {
    and.push({
      OR: [
        { name: { contains: p.q, mode: "insensitive" } },
        { shortDesc: { contains: p.q, mode: "insensitive" } },
      ],
    });
  }
  if (p.tag) and.push({ tags: { has: p.tag } });
  if (p.format !== "any") and.push({ ranked: p.format === "ranked" });
  return { AND: and };
}

function orderFor(p: JamListParams, phase: ListedPhase | null): Prisma.JamOrderByWithRelationInput {
  if (p.sort === "newest") return { publishedAt: "desc" };
  if (p.sort === "joined") return { participants: { _count: "desc" } };
  return phase ? PHASE_ORDER[phase] : { publishedAt: "desc" };
}

type Row = Prisma.JamGetPayload<{ select: typeof SELECT }>;

function toSummary(row: Row, now: Date): JamSummary {
  return {
    id: row.id, slug: row.slug, name: row.name, shortDesc: row.shortDesc, coverUrl: row.coverUrl,
    tags: row.tags, ranked: row.ranked, publishedAt: row.publishedAt, startDate: row.startDate,
    endDate: row.endDate, ratingEnd: row.ratingEnd, phase: jamPhase(row, now),
    joined: row._count.participants, entries: row._count.submissions,
  };
}

export async function loadJamList(params: JamListParams, now = new Date()): Promise<JamList> {
  const base = baseWhere(params);
  const where = (phase: ListedPhase): Prisma.JamWhereInput => ({ AND: [base, jamPhaseWhere(phase, now)] });
  const take = params.show + 1;

  const [live, upcoming, rating, finished, tagRows] = await Promise.all([
    db.jam.count({ where: where("ONGOING") }),
    db.jam.count({ where: where("UPCOMING") }),
    db.jam.count({ where: where("RATING") }),
    db.jam.count({ where: where("FINISHED") }),
    db.jam.findMany({ where: LISTED_JAM, select: { tags: true }, take: 500 }),
  ]);
  const counts: Record<ListStatus, number> = {
    all: live + upcoming + rating + finished, live, upcoming, rating, finished,
  };

  let rows: Row[];
  if (params.status !== "all") {
    const phase = STATUS_PHASE[params.status];
    rows = await db.jam.findMany({ where: where(phase), select: SELECT, orderBy: orderFor(params, phase), take });
  } else if (params.sort === "relevant") {
    const groups = await Promise.all(
      RELEVANT_PHASES.map((phase) =>
        db.jam.findMany({ where: where(phase), select: SELECT, orderBy: PHASE_ORDER[phase], take })
      )
    );
    rows = groups.flat();
  } else {
    rows = await db.jam.findMany({ where: base, select: SELECT, orderBy: orderFor(params, null), take });
  }

  return {
    jams: rows.slice(0, params.show).map((r) => toSummary(r, now)),
    counts,
    tags: topTags(tagRows.map((r) => r.tags)),
    hasMore: rows.length > params.show,
  };
}
```

- [x] **Step 7: Reuse the filters on the homepage**

In `src/lib/home-queries.ts` replace the local `LISTED` constant with `LISTED_JAM`, and the
four hand-written phase conditions with `jamPhaseWhere("ONGOING" | "RATING" | "UPCOMING" |
"FINISHED", now)`. Keep each query's `orderBy` and `take`. Run
`pnpm test:integration tests/integration/home-queries.integration.test.ts` → still PASS.

- [x] **Step 8: Verify and commit**

Run: `pnpm test && pnpm test:integration && pnpm lint && pnpm exec tsc --noEmit` → all pass.

```bash
git add src/lib/jam-phase-where.ts src/lib/jam-list-params.ts src/lib/jam-list-params.test.ts src/lib/jam-list-queries.ts src/lib/home-queries.ts tests/integration/jam-list-queries.integration.test.ts vitest.config.mts
git commit -m "feat(jams): SQL phase filters and jam list loader"
```

---

### Task 3: Jam list page

**Files:**

- Create: `src/components/jam/jam-card.tsx`
- Create: `src/app/jams/jam-filters.tsx`
- Modify: `src/app/jams/page.tsx`

**Interfaces:**

- Consumes: `loadJamList`, `JamSummary`, `parseJamListParams`, `jamListHref` (Task 2);
  `CoverImage`, `LinkTabs` (Task 1); `JamStatusBadge`, `JamProgress`, `phaseProgress`,
  `jamStatus`, `TONE_TEXT` (foundations).
- Produces: `<JamCard jam={JamSummary} now={Date} />`; `<JamFilters params={JamListParams} />`.

Visual reference: boards **Browse jams** (desktop) and **Browse jams — mobile**.

- [x] **Step 1: `JamCard`**

A single `<article className="relative flex flex-col overflow-hidden rounded-xl border bg-card">`:

- Cover: `<CoverImage src={jam.coverUrl} alt="" name={jam.name} className="h-30 w-full border-b" />`
  (decorative here because the title follows) with the `JamStatusBadge` absolutely positioned
  bottom-left (`absolute left-3.5 top-[5.75rem]` or place it in a `relative` wrapper at
  `bottom-3.5 left-3.5`, on a `bg-background` pill).
- Body `p-4 flex flex-col gap-2.5 grow`: title link
  `<Link href={`/jams/${jam.slug}`} className="font-semibold after:absolute after:inset-0">`
  (stretched link: the whole card is the target, the card holds no other interactive
  element); short description `line-clamp-2 text-sm text-muted-foreground`; at the bottom
  (`mt-auto`) `<JamProgress phase={jam.phase} value={phaseProgress(jam, jam.phase, now)} />`
  and a row: dates `font-mono text-xs` as `"MMM dd → MMM dd"` (UTC, `Intl.DateTimeFormat("en",
  { month: "short", day: "2-digit", timeZone: "UTC" })`), and `"{Ranked|Showcase} · {joined}
  joined"` in `text-xs text-subtle-foreground`.

- [x] **Step 2: `JamFilters` (client)**

`"use client"`. Two labelled native `<select>`s (Format: Any / Ranked / Showcase; Sort:
Relevant first / Newest / Most joined), styled `h-10 rounded-lg border border-input bg-card
px-2.5 text-sm` (`min-h-11` on mobile). On change, `router.push(jamListHref(params, { format }))`
(or `{ sort }`). Import `jamListHref` and the types from `@/lib/jam-list-params` (a pure module,
safe on the client).

- [x] **Step 3: Rebuild `src/app/jams/page.tsx`**

Keep `metadata` (title "Jams"), the Suspense boundary and a skeleton. `searchParams` is a
`Promise<Record<string, string | string[] | undefined>>`; parse it once with
`parseJamListParams`. Layout (container `mx-auto max-w-7xl px-4 py-8 md:px-12 md:py-12`):

1. Title row: `<h1 className="text-3xl font-semibold tracking-tight">Jams</h1>` with
   "Find something to build this weekend — or next month." and a primary "Host a jam" link to
   `/jams/new` (`buttonVariants()`, `h-10`, `min-h-11` on mobile).
2. Filter row (`flex flex-wrap items-center gap-3 border-b pb-5`):
   - Status segmented control built from links (not `LinkTabs`; it is a pill group):
     All / Live / Upcoming / Rating / Finished, each `href={jamListHref(params, { status })}`,
     `aria-current="page"` on the active one, count in `font-mono text-xs`. On mobile the group is a
     horizontally scrolling row (`no-scrollbar overflow-x-auto`) with pill buttons
     `min-h-11`.
   - Search: a GET `<form action="/jams">` with a labelled `<input type="search" name="q"
     defaultValue={params.q} maxLength={100}>` and hidden inputs carrying the current
     `status`, `tag`, `format`, `sort` (omit defaults). The visible label is visually hidden
     (`sr-only`).
   - `<JamFilters params={params} />`.
3. Tag chips: "Tags" label and one link per `list.tags` entry to
   `jamListHref(params, { tag: active ? "" : tag })`, `aria-pressed` is not valid on links —
   use `aria-current="true"` on the active chip instead; chips `min-h-11 md:min-h-7`.
4. Grid `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` of `<JamCard>`.
5. `hasMore` → centered outline link "Load more" to
   `jamListHref(params, { show: params.show + JAM_LIST_PAGE_SIZE })` with `scroll={false}`.
6. Empty state (`list.jams.length === 0`): "No jams match these filters." and a link "Clear
   filters" to `/jams`.

- [x] **Step 4: Verify**

Run: `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build`. Then
`pnpm test:e2e` (the existing "jams listing shows a seeded public jam" test must still pass;
if port 3000 serves another checkout, run `pnpm exec next dev -p 3100` and
`E2E_BASE_URL=http://localhost:3100 pnpm test:e2e`). Manual check against the boards at
1440px and 390px, both themes: `/jams`, `/jams?status=live`, `/jams?tag=…`,
`/jams?status=nope&show=99999`.

- [x] **Step 5: Commit**

```bash
git add src/components/jam/jam-card.tsx src/app/jams/jam-filters.tsx src/app/jams/page.tsx
git commit -m "feat(jams): redesigned jam list with status tabs, tags and filters"
```

---

### Task 4: Jam page data and helpers

**Files:**

- Create: `src/lib/jam-page.ts`, `src/lib/jam-page.test.ts`
- Create: `src/lib/jam-page-queries.ts`
- Create: `tests/integration/jam-page-queries.integration.test.ts`
- Modify: `vitest.config.mts` (exclude `src/lib/jam-page-queries.ts` from unit coverage)

**Interfaces:**

- Consumes: `canJoin` (`@/domain/participation`), `canCreateSubmission`
  (`@/domain/submission`), `phaseProgress`, `nextDeadline` (foundations), `hasPermission`,
  `resultsAccess`.
- Produces:

```ts
// src/lib/jam-page.ts
export type TimelineState = "past" | "current" | "future";
export interface TimelineSegment {
  key: "upcoming" | "jam" | "rating";
  label: string;       // "Upcoming" | "Jam" | "Rating"
  dates: string;       // e.g. "Sep 26 → Oct 02" (UTC); "" when unknown
  widthPct: number;    // fixed layout share, sums to 100
  state: TimelineState;
  progress: number;    // 0–100, only meaningful for the current segment
}
export function jamTimeline(jam: JamPhaseInput, phase: JamPhase, now?: Date): TimelineSegment[];

export type EntryPanel =
  | { kind: "signed-out"; canJoin: boolean }
  | { kind: "can-join" }
  | { kind: "joined"; canCreate: boolean }
  | { kind: "has-entry"; submissionId: string; status: "DRAFT" | "SUBMITTED" }
  | { kind: "closed" };
export function entryPanelState(input: {
  signedIn: boolean;
  phase: JamPhase;
  hasJoined: boolean;
  submission: { id: string; status: "DRAFT" | "SUBMITTED" } | null;
}): EntryPanel;

// src/lib/jam-page-queries.ts
export interface JamViewer {
  userId: string | null;
  roles: ("ADMIN" | "MODERATOR" | "JUDGE" | "HOST")[];
  canEditJam: boolean;
  canManageRoles: boolean;
  canModerate: boolean;      // edit_submission
  canPreviewResults: boolean;
  hasJoined: boolean;
  submission: { id: string; status: "DRAFT" | "SUBMITTED" } | null;
}
export interface JamPageData {
  jam: /* the Prisma jam row with createdBy, roles (with user), criteria and _count
          {participants, submissions (SUBMITTED, visible, not deleted)} */;
  phase: JamPhase;
  viewer: JamViewer;
  resultsVisible: boolean;   // resultsAccess(...) !== "none"
}
export const loadJamPage: (slug: string, userId: string | null) => Promise<JamPageData | null>;
```

`loadJamPage` returns `null` when the jam does not exist, or when it is a DRAFT and the viewer
holds no role on it (the page calls `notFound()` on `null`).

- [x] **Step 1: Write the failing unit tests**

`src/lib/jam-page.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { entryPanelState, jamTimeline } from "@/lib/jam-page";

const DAY = 86_400_000;
const base = new Date("2026-10-01T00:00:00Z");
const at = (d: number) => new Date(base.getTime() + d * DAY);
const ranked = {
  publishedAt: at(-10), startDate: at(-2), endDate: at(2), ratingEnd: at(12), ranked: true,
};

describe("jamTimeline", () => {
  it("has three segments for a ranked jam, the jam segment current while live", () => {
    const t = jamTimeline(ranked, "ONGOING", base);
    expect(t.map((s) => [s.key, s.state])).toEqual([
      ["upcoming", "past"], ["jam", "current"], ["rating", "future"],
    ]);
    expect(t.reduce((n, s) => n + s.widthPct, 0)).toBe(100);
    expect(t[1].progress).toBe(50);
    expect(t[1].dates).toBe("Sep 29 → Oct 03");
    expect(t[2].dates).toBe("Oct 03 → Oct 13");
  });
  it("has two segments for a showcase jam", () => {
    const t = jamTimeline({ ...ranked, ranked: false, ratingEnd: null }, "UPCOMING", base);
    expect(t.map((s) => s.key)).toEqual(["upcoming", "jam"]);
    expect(t[0].state).toBe("current");
    expect(t.reduce((n, s) => n + s.widthPct, 0)).toBe(100);
  });
  it("marks everything past when finished", () => {
    expect(jamTimeline(ranked, "FINISHED", base).every((s) => s.state === "past")).toBe(true);
  });
  it("leaves dates empty when they are missing (draft)", () => {
    const t = jamTimeline({ ...ranked, publishedAt: null, startDate: null, endDate: null, ratingEnd: null }, "DRAFT", base);
    expect(t.every((s) => s.state === "future" && s.dates === "")).toBe(true);
  });
});

describe("entryPanelState", () => {
  const none = { signedIn: true, hasJoined: false, submission: null };
  it("asks signed-out visitors to sign in, saying whether they could join", () => {
    expect(entryPanelState({ ...none, signedIn: false, phase: "UPCOMING" })).toEqual({ kind: "signed-out", canJoin: true });
    expect(entryPanelState({ ...none, signedIn: false, phase: "FINISHED" })).toEqual({ kind: "signed-out", canJoin: false });
  });
  it("offers joining while the jam is upcoming or live", () => {
    expect(entryPanelState({ ...none, phase: "ONGOING" })).toEqual({ kind: "can-join" });
  });
  it("lets joined users create a submission only while live", () => {
    expect(entryPanelState({ ...none, hasJoined: true, phase: "ONGOING" })).toEqual({ kind: "joined", canCreate: true });
    expect(entryPanelState({ ...none, hasJoined: true, phase: "UPCOMING" })).toEqual({ kind: "joined", canCreate: false });
  });
  it("points to the existing entry", () => {
    expect(
      entryPanelState({ ...none, hasJoined: true, phase: "RATING", submission: { id: "s1", status: "SUBMITTED" } })
    ).toEqual({ kind: "has-entry", submissionId: "s1", status: "SUBMITTED" });
  });
  it("is closed for outsiders once submissions close", () => {
    expect(entryPanelState({ ...none, phase: "RATING" })).toEqual({ kind: "closed" });
  });
});
```

Run: `pnpm test src/lib/jam-page.test.ts` → FAIL (module not found).

- [x] **Step 2: Implement `src/lib/jam-page.ts`**

```ts
import type { JamPhase, JamPhaseInput } from "@/domain/jam-phase";
import { canJoin } from "@/domain/participation";
import { canCreateSubmission } from "@/domain/submission";
import { phaseProgress } from "@/lib/jam-status-display";

// TimelineState, TimelineSegment, EntryPanel: exactly as in this task's Interfaces block.

const DAY = new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", timeZone: "UTC" });

function range(from: Date | null, to: Date | null): string {
  if (!from || !to) return "";
  return `${DAY.format(from)} → ${DAY.format(to)}`;
}

// Segment widths are fixed shares, not proportional to durations: an upcoming window can be
// months long, which would squash the jam itself to a sliver.
const ORDER: Record<JamPhase, number> = { DRAFT: -1, UPCOMING: 0, ONGOING: 1, RATING: 2, FINISHED: 3 };

export function jamTimeline(jam: JamPhaseInput, phase: JamPhase, now = new Date()): TimelineSegment[] {
  const defs = jam.ranked
    ? [
        { key: "upcoming", label: "Upcoming", index: 0, width: 18, dates: range(jam.publishedAt, jam.startDate) },
        { key: "jam", label: "Jam", index: 1, width: 37, dates: range(jam.startDate, jam.endDate) },
        { key: "rating", label: "Rating", index: 2, width: 45, dates: range(jam.endDate, jam.ratingEnd) },
      ] as const
    : [
        { key: "upcoming", label: "Upcoming", index: 0, width: 25, dates: range(jam.publishedAt, jam.startDate) },
        { key: "jam", label: "Jam", index: 1, width: 75, dates: range(jam.startDate, jam.endDate) },
      ] as const;
  const current = ORDER[phase];
  return defs.map((d) => {
    const state: TimelineState =
      current < 0 ? "future" : d.index < current ? "past" : d.index === current ? "current" : "future";
    let progress = state === "past" ? 100 : 0;
    if (state === "current") {
      progress = d.key === "upcoming"
        ? upcomingProgress(jam, now)
        : phaseProgress(jam, phase, now);
    }
    return { key: d.key, label: d.label, dates: d.dates, widthPct: d.width, state, progress };
  });
}

function upcomingProgress(jam: JamPhaseInput, now: Date): number {
  if (!jam.publishedAt || !jam.startDate) return 0;
  const span = jam.startDate.getTime() - jam.publishedAt.getTime();
  if (span <= 0) return 100;
  const pct = ((now.getTime() - jam.publishedAt.getTime()) / span) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function entryPanelState(input: {
  signedIn: boolean;
  phase: JamPhase;
  hasJoined: boolean;
  submission: { id: string; status: "DRAFT" | "SUBMITTED" } | null;
}): EntryPanel {
  const joinable = canJoin({ phase: input.phase, hasJoined: false }).allowed;
  if (!input.signedIn) return { kind: "signed-out", canJoin: joinable };
  if (input.submission) {
    return { kind: "has-entry", submissionId: input.submission.id, status: input.submission.status };
  }
  if (input.hasJoined) {
    const canCreate = canCreateSubmission({ phase: input.phase, hasJoined: true, hasSubmission: false }).allowed;
    return { kind: "joined", canCreate };
  }
  return joinable ? { kind: "can-join" } : { kind: "closed" };
}
```

Run: `pnpm test src/lib/jam-page.test.ts` → PASS. (The dates in the first test are
`at(-2)` = Sep 29 and `at(2)` = Oct 03 in UTC.)

- [x] **Step 3: Write the failing integration test**

`tests/integration/jam-page-queries.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { loadJamPage } from "@/lib/jam-page-queries";
import { createJam, createSubmission, createUser, daysFromNow, grantJamRole, joinJam } from "./factories";

describe("loadJamPage", () => {
  it("returns null for unknown slugs and hides drafts from non-organizers", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const draft = await createJam(owner.id, { slug: "secret-draft" });
    await grantJamRole(draft.id, owner.id, "ADMIN");

    expect(await loadJamPage("does-not-exist", null)).toBeNull();
    expect(await loadJamPage("secret-draft", null)).toBeNull();
    expect(await loadJamPage("secret-draft", outsider.id)).toBeNull();
    const asOwner = await loadJamPage("secret-draft", owner.id);
    expect(asOwner?.phase).toBe("DRAFT");
    expect(asOwner?.viewer.canEditJam).toBe(true);
  });

  it("describes the viewer: joined, entry, permissions", async () => {
    const owner = await createUser();
    const player = await createUser();
    const jam = await createJam(owner.id, {
      slug: "live-jam", visibility: "PUBLIC", publishedAt: daysFromNow(-2),
      startDate: daysFromNow(-1), endDate: daysFromNow(1),
    });
    await joinJam(jam.id, player.id);
    const sub = await createSubmission(jam.id, player.id);

    const page = await loadJamPage("live-jam", player.id);
    expect(page?.phase).toBe("ONGOING");
    expect(page?.viewer).toMatchObject({
      hasJoined: true,
      submission: { id: sub.id, status: "DRAFT" },
      canEditJam: false,
      canModerate: false,
    });
    const anon = await loadJamPage("live-jam", null);
    expect(anon?.viewer).toMatchObject({ userId: null, hasJoined: false, submission: null });
  });

  it("ignores deleted submissions when finding the viewer's entry", async () => {
    const owner = await createUser();
    const jam = await createJam(owner.id, {
      slug: "deleted-entry", visibility: "PUBLIC", publishedAt: daysFromNow(-2),
      startDate: daysFromNow(-1), endDate: daysFromNow(1),
    });
    const sub = await createSubmission(jam.id, owner.id);
    await db.submission.update({ where: { id: sub.id }, data: { deletedAt: new Date() } });
    expect((await loadJamPage("deleted-entry", owner.id))?.viewer.submission).toBeNull();
  });
});
```

Run: `pnpm test:integration tests/integration/jam-page-queries.integration.test.ts` → FAIL.

- [x] **Step 4: Implement `src/lib/jam-page-queries.ts`**

```ts
import { cache } from "react";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { jamPhase } from "@/domain/jam-phase";
import { resultsAccess } from "@/domain/results";

const LIVE_SUBMISSIONS = { status: "SUBMITTED", visible: true, deletedAt: null } as const;

async function findJam(slug: string) {
  return db.jam.findUnique({
    where: { slug },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      roles: { include: { user: { select: { username: true, displayName: true, avatarUrl: true } } } },
      criteria: {
        select: { id: true, name: true, description: true, weight: true, isPrimary: true },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { participants: true, submissions: { where: LIVE_SUBMISSIONS } } },
    },
  });
}

// JamViewer and JamPageData: as in this task's Interfaces block; type `jam` as
// `NonNullable<Awaited<ReturnType<typeof findJam>>>`.

// Wrapped in React cache() so the header, the tab body and generateMetadata share one
// query per request.
export const loadJamPage = cache(async (slug: string, userId: string | null): Promise<JamPageData | null> => {
  const jam = await findJam(slug);
  if (!jam) return null;
  const phase = jamPhase(jam);
  const roles = userId ? jam.roles.filter((r) => r.userId === userId).map((r) => r.role) : [];
  if (phase === "DRAFT" && roles.length === 0) return null;

  const [participant, member] = userId
    ? await Promise.all([
        db.jamParticipant.findUnique({ where: { jamId_userId: { jamId: jam.id, userId } } }),
        db.submissionMember.findFirst({
          where: { userId, submission: { jamId: jam.id, deletedAt: null } },
          select: { submission: { select: { id: true, status: true } } },
        }),
      ])
    : [null, null];

  const canPreviewResults = hasPermission(roles, "preview_results");
  return {
    jam,
    phase,
    viewer: {
      userId,
      roles,
      canEditJam: hasPermission(roles, "edit_jam"),
      canManageRoles: hasPermission(roles, "manage_roles"),
      canModerate: hasPermission(roles, "edit_submission"),
      canPreviewResults,
      hasJoined: Boolean(participant),
      submission: member?.submission ?? null,
    },
    resultsVisible: resultsAccess({ ...jam, phase, canPreviewResults }) !== "none",
  };
});
```

Confirm `avatarUrl` and `sortOrder` exist (`grep -n "avatarUrl\|sortOrder" prisma/schema.prisma`).
If the soft-delete extension already filters `deletedAt` on `findUnique`, the explicit
`deletedAt: null` inside the relation filter is still needed (relation filters bypass it).

Run the integration test → PASS.

- [x] **Step 5: Verify and commit**

Run: `pnpm test && pnpm test:integration && pnpm lint && pnpm exec tsc --noEmit`.

```bash
git add src/lib/jam-page.ts src/lib/jam-page.test.ts src/lib/jam-page-queries.ts tests/integration/jam-page-queries.integration.test.ts vitest.config.mts
git commit -m "feat(jam): jam page loader, timeline and entry panel helpers"
```

---

### Task 5: Jam header and overview tab

**Files:**

- Create: `src/components/jam/jam-timeline.tsx`
- Create: `src/app/jams/[slug]/jam-header.tsx`
- Modify: `src/app/jams/[slug]/jam-actions-client.tsx`
- Modify: `src/app/jams/[slug]/page.tsx`, `src/app/jams/[slug]/loading.tsx`

**Interfaces:**

- Consumes: `loadJamPage`, `JamPageData` (Task 4); `jamTimeline`, `entryPanelState` (Task
  4); `CoverImage`, `LinkTabs`, `initials`, `ratingEligibilityLabel`, `jamRoleLabel` (Task 1);
  `JamStatusBadge`, `Countdown`, `nextDeadline`, `TONE_BG` (foundations); `Markdown`.
- Produces:
  - `<JamTimeline jam={JamPhaseInput} phase={JamPhase} now={Date} />`
  - `<JamHeader data={JamPageData} active="overview" | "submissions" | "results" />`
  - `JoinJamButton` and `PublishJamButton` keep their names and props.

Visual reference: boards **Jam — overview (live, joined)** and **Jam page — mobile**.

- [x] **Step 1: `JamTimeline`**

A `<section aria-label="Jam timeline" className="flex flex-col gap-5 rounded-xl border bg-card p-5 md:flex-row md:items-center md:gap-10 md:px-6">`:

- Left block (`md:w-56 shrink-0`): when `nextDeadline(jam, phase)` exists, the label
  `"{label} in"` (`text-sm text-muted-foreground`), `<Countdown to={deadline.at.toISOString()} className="text-2xl md:text-[1.75rem] font-medium tracking-tight" />`,
  and the absolute time in UTC (`font-mono text-xs text-subtle-foreground`, e.g.
  `"Oct 02, 18:00 UTC"`). When there is none: FINISHED → "Finished"; DRAFT → "Not published
  yet".
- Right block: a `flex gap-[3px] h-1.5` bar with one div per segment (`style={{ width: `${widthPct}%` }}`,
  `rounded-full`): past → `bg-input`, future → `bg-track`, current → `bg-track` with an inner
  fill `TONE_BG[jamStatus(phase).tone]` at `progress%`. Under it, one column per segment (same
  widths): the label (current one `font-medium text-foreground`, add " — now"; others
  `text-subtle-foreground`) and `dates` in `font-mono text-xs`. On mobile keep the bar and
  labels; hide the date lines below `sm` except for the current segment.

- [x] **Step 2: Restyle the client buttons**

In `jam-actions-client.tsx` keep the logic. `JoinJamButton`: primary button
`h-10 min-h-11 md:min-h-10 px-4`, label "Join jam" / "Joining…". Add an optional
`className?: string` prop to both buttons and pass it to the `Button`. Errors stay in a
`text-destructive text-sm` paragraph with `role="alert"`.

- [x] **Step 3: `JamHeader`**

Server component `jam-header.tsx` rendering, inside the page container
(`mx-auto max-w-7xl px-4 md:px-12`):

1. Cover banner: full-width `<CoverImage src={jam.coverUrl} alt="" name={jam.name} className="h-36 w-full md:h-56 md:rounded-none" />`
   placed **before** the container (edge to edge, `border-b`).
2. Identity row (`-mt-8 md:-mt-11 flex flex-col gap-4 md:flex-row md:items-end md:gap-6 pb-6`):
   an 64/88px tile `rounded-2xl border bg-card` with `initials(jam.name)`; then breadcrumb
   (`<nav aria-label="Breadcrumb">` "Jams / {slug}", link to `/jams`), `<h1>` (`text-2xl
   md:text-4xl font-semibold tracking-tight`), `<JamStatusBadge phase />`, an "Unlisted"
   outline tag when `jam.visibility === "UNLISTED"`, the short description
   (`text-muted-foreground`) and the hashtag in `text-subtle-foreground`.
3. Actions (right on desktop, full-width stack on mobile):
   - `viewer.canEditJam && phase === "DRAFT"` → `<PublishJamButton />`
   - `viewer.canEditJam` → outline link "Edit" to `/jams/{slug}/edit`
   - by `entryPanelState(...)`: `can-join` → `<JoinJamButton />`; `joined` + `canCreate` →
     primary link "Create submission" to `/jams/{slug}/submissions/new`; `has-entry` → outline
     link "Your submission" to `/submissions/{id}`; `joined` → a non-interactive "Joined" chip
     with a check icon (`text-live`); `signed-out` + `canJoin` → primary link "Sign in to
     join" to `/sign-in?callbackUrl=/jams/{slug}`.
4. `<JamTimeline />` (skip when DRAFT and no dates: it shows "Not published yet").
5. `<LinkTabs label="Jam sections" tabs={…}>`: Overview (`/jams/{slug}`), Submissions
   (`/jams/{slug}/submissions`, count `jam._count.submissions`), Results (only when
   `data.resultsVisible`, `/jams/{slug}/results`), Manage (only when `viewer.canManageRoles`,
   `/jams/{slug}/manage`, pushed right on desktop with `md:ml-auto`).

- [x] **Step 4: Rebuild the overview page**

`src/app/jams/[slug]/page.tsx`:

- `generateMetadata` uses `loadJamPage(slug, null)`; `null` → `{ title: "Jam Not Found" }`
  (drafts return `null` for anonymous viewers, so they no longer leak their name either).
- The page: `const session = await auth(); const data = await loadJamPage(slug, session?.user?.id ?? null); if (!data) notFound();`
  then `<JamHeader data={data} active="overview" />` and a body grid
  (`grid gap-10 pt-8 pb-16 md:grid-cols-12`):
  - Main (`md:col-span-8 flex flex-col gap-8`):
    - Theme card (`rounded-xl border p-6`): heading "Theme" (`text-sm text-subtle-foreground`),
      the theme in `text-3xl font-semibold tracking-tight` when shown; when
      `revealThemeOnStart && phase === "UPCOMING" && jam.theme` show "Revealed when the jam
      starts." in `text-muted-foreground` instead; no card when there is no theme.
    - "About this jam" `<h2>` + `<Markdown>{jam.fullDesc}</Markdown>` (keep the `prose`
      wrapper the Markdown component provides; the smoke test checks `.prose h2`).
    - "Submitting" `<h2>` + `<Markdown>{jam.submissionDetails}</Markdown>` when set.
    - Ranked jams with criteria: "Rating criteria" `<h2>` and a bordered list: name,
      description (`text-sm text-subtle-foreground`), `font-mono text-xs` "weight {n}" and a
      "Primary" tag on the primary criterion; footer row (`bg-card text-sm
      text-subtle-foreground`): "Overall = weighted average of criteria. Rated 1–5,
      Bayesian-adjusted." when no criterion is primary, or "Overall = {primary name}." when
      one is.
  - Aside (`md:col-span-4 flex flex-col gap-6`):
    - "Your entry" card (`rounded-xl border bg-card p-5`) driven by `entryPanelState`:
      - `signed-out`: "Sign in to join this jam and submit a game." + primary "Sign in" link
        (or "Submissions are closed." when `!canJoin`).
      - `can-join`: "Join to submit a game or team up." + `<JoinJamButton className="w-full" />`.
      - `joined` + `canCreate`: "You've joined but haven't submitted yet. Start a draft now —
        teammates can be added until {endDate UTC}." + full-width primary "Create submission".
      - `joined` + `!canCreate`: "You've joined. Submissions open when the jam starts."
      - `has-entry`: "Your game: {status Draft | Submitted}" + outline "Open your submission".
      - `closed`: "Submissions are closed." (render the card only if you want parity; it can
        be omitted).
    - Details `<dl>` rows (`border-b py-2.5 text-sm`, term `text-muted-foreground`): Format
      (Ranked / Showcase), Team size ("Up to {n}" or "Any size"), Who can rate
      (`ratingEligibilityLabel`, ranked only), Joined (`_count.participants`, mono),
      Submissions (`_count.submissions`, mono), Results ("Revealed by organizers" when
      `hideResults`, else "Public when rating ends"; ranked only).
    - Organizers: one row per role entry grouped by user — avatar
      (`CoverImage`-style 28px circle: the user's `avatarUrl` via `<img>` with
      `referrerPolicy="no-referrer"`, else initials), name link to `/users/{username}`
      (`min-h-11 flex items-center` on mobile), roles joined with " · " via `jamRoleLabel`.
    - Tags: chips linking to `/jams?tag={tag}` (`min-h-11 md:min-h-7`).

- [x] **Step 5: Loading skeleton**

`loading.tsx`: a `h-36 md:h-56` muted banner, a title block, a `h-28` rounded timeline block,
a tab row and a two-column body with muted blocks — shapes matching the new layout.

- [x] **Step 6: Verify**

Run: `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build`, then the e2e suite
(`public jam detail page renders` and the `.prose h2` check must pass). Manual check against
the boards at 1440px and 390px, both themes: an upcoming jam with a hidden theme, a live jam
signed out / joined / with an entry, a finished ranked jam (Results tab visible when public),
a draft as its admin.

- [x] **Step 7: Commit**

```bash
git add src/components/jam/jam-timeline.tsx "src/app/jams/[slug]/jam-header.tsx" "src/app/jams/[slug]/jam-actions-client.tsx" "src/app/jams/[slug]/page.tsx" "src/app/jams/[slug]/loading.tsx"
git commit -m "feat(jam): redesigned jam header, timeline and overview"
```

---

### Task 6: Jam submissions tab

**Files:**

- Create: `src/lib/jam-entries.ts`, `src/lib/jam-entries.test.ts`
- Create: `src/lib/jam-entries-queries.ts`
- Create: `tests/integration/jam-entries-queries.integration.test.ts`
- Create: `src/app/jams/[slug]/submissions/page.tsx`
- Delete: `src/app/jams/[slug]/submission-list.tsx`
- Modify: `vitest.config.mts` (exclude `src/lib/jam-entries-queries.ts` from unit coverage)

**Interfaces:**

- Consumes: `loadJamPage` (Task 4), `JamHeader` (Task 5), `canRate` (`@/domain/rating`),
  `loadRater` (`@/lib/rating-queries`), `platformLabel`, `CoverImage` (Task 1).
- Produces:

```ts
// src/lib/jam-entries.ts
export type Platform = "WINDOWS" | "MAC" | "LINUX" | "WEB";
export type EntriesSort = "fewest" | "newest" | "title";
export interface EntriesParams { platforms: Platform[]; hideRated: boolean; sort: EntriesSort }
export function parseEntriesParams(raw: Record<string, string | string[] | undefined>, phase: JamPhase): EntriesParams;
export function entriesHref(slug: string, phase: JamPhase, params: EntriesParams, change?: Partial<EntriesParams>): string;
export interface QueueEntry { id: string; createdAt: Date; raters: number; eligible: boolean; ratedByViewer: boolean }
export function nextToRate(entries: QueueEntry[]): string | null;

// src/lib/jam-entries-queries.ts
export interface EntryCard {
  id: string;
  title: string;
  coverUrl: string | null;
  platforms: Platform[];
  team: { username: string; displayName: string | null; isLeader: boolean }[];
  competing: boolean;
  rateable: boolean;
  raters: number;            // distinct users who rated it
  ratedByViewer: boolean;
  isViewerTeam: boolean;
  eligible: boolean;         // canRate(...) for the viewer
  createdAt: Date;
}
export interface JamEntries {
  hidden: boolean;           // list withheld from this viewer (hideSubmissionsBeforeEnd while ONGOING)
  ownOnly: boolean;          // list restricted to the viewer's own entry for the same reason
  entries: EntryCard[];      // after filters and sort
  progress: { rated: number; eligible: number; next: string | null } | null; // null unless the viewer can rate
}
export function loadJamEntries(
  data: JamPageData,
  params: EntriesParams
): Promise<JamEntries>;
```

- [x] **Step 1: Write the failing unit tests**

`src/lib/jam-entries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { entriesHref, nextToRate, parseEntriesParams } from "@/lib/jam-entries";

const t = (d: number) => new Date(Date.UTC(2026, 9, d));

describe("parseEntriesParams", () => {
  it("defaults to fewest ratings first while rating, newest otherwise", () => {
    expect(parseEntriesParams({}, "RATING")).toEqual({ platforms: [], hideRated: false, sort: "fewest" });
    expect(parseEntriesParams({}, "FINISHED").sort).toBe("newest");
  });
  it("reads a comma list of known platforms and drops the rest", () => {
    expect(parseEntriesParams({ platforms: "web,windows,atari,web" }, "RATING").platforms).toEqual(["WEB", "WINDOWS"]);
  });
  it("only honours hideRated and fewest during rating", () => {
    expect(parseEntriesParams({ hideRated: "1", sort: "fewest" }, "FINISHED")).toMatchObject({ hideRated: false, sort: "newest" });
    expect(parseEntriesParams({ hideRated: "1", sort: "title" }, "RATING")).toMatchObject({ hideRated: true, sort: "title" });
  });
});

describe("entriesHref", () => {
  it("serialises only non-defaults", () => {
    const p = parseEntriesParams({}, "RATING");
    expect(entriesHref("jam", "RATING", p)).toBe("/jams/jam/submissions");
    expect(entriesHref("jam", "RATING", p, { platforms: ["WEB", "MAC"], hideRated: true })).toBe(
      "/jams/jam/submissions?platforms=web,mac&hideRated=1"
    );
  });
  it("keeps a sort that differs from the phase default", () => {
    const rating = parseEntriesParams({}, "RATING");
    expect(entriesHref("jam", "RATING", rating, { sort: "newest" })).toBe("/jams/jam/submissions?sort=newest");
    const finished = parseEntriesParams({}, "FINISHED");
    expect(entriesHref("jam", "FINISHED", finished, { sort: "newest" })).toBe("/jams/jam/submissions");
    expect(entriesHref("jam", "FINISHED", finished, { sort: "title" })).toBe("/jams/jam/submissions?sort=title");
  });
});

describe("nextToRate", () => {
  const e = (id: string, raters: number, day: number, extra: Partial<{ eligible: boolean; ratedByViewer: boolean }> = {}) => ({
    id, raters, createdAt: t(day), eligible: true, ratedByViewer: false, ...extra,
  });
  it("picks the least-rated eligible entry the viewer has not rated, oldest first on ties", () => {
    expect(nextToRate([e("a", 3, 1), e("b", 1, 3), e("c", 1, 2), e("d", 0, 1, { ratedByViewer: true })])).toBe("c");
  });
  it("skips ineligible entries (own team, not rateable)", () => {
    expect(nextToRate([e("a", 0, 1, { eligible: false }), e("b", 5, 1)])).toBe("b");
  });
  it("returns null when nothing is left", () => {
    expect(nextToRate([e("a", 0, 1, { ratedByViewer: true }), e("b", 0, 1, { eligible: false })])).toBeNull();
    expect(nextToRate([])).toBeNull();
  });
});
```

Run: `pnpm test src/lib/jam-entries.test.ts` → FAIL.

- [x] **Step 2: Implement `src/lib/jam-entries.ts`**

```ts
import type { JamPhase } from "@/domain/jam-phase";

// Platform, EntriesSort, EntriesParams, QueueEntry: as in this task's Interfaces block.

const PLATFORMS: Platform[] = ["WINDOWS", "MAC", "LINUX", "WEB"];
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
```

All values in the query string come from fixed lists (platform enums, `1`, sort names), so
building it by hand needs no escaping. Run the tests → PASS.

- [x] **Step 3: Write the failing integration test**

`tests/integration/jam-entries-queries.integration.test.ts`:

```ts
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
```

Run: `pnpm test:integration tests/integration/jam-entries-queries.integration.test.ts` → FAIL.

- [x] **Step 4: Implement `src/lib/jam-entries-queries.ts`**

```ts
import { db } from "@/lib/db";
import { canRate } from "@/domain/rating";
import { loadRater } from "@/lib/rating-queries";
import type { JamPageData } from "@/lib/jam-page-queries";
import type { EntriesParams, Platform } from "@/lib/jam-entries";
import { nextToRate } from "@/lib/jam-entries";

// EntryCard and JamEntries: as in this task's Interfaces block.

export async function loadJamEntries(data: JamPageData, params: EntriesParams): Promise<JamEntries> {
  const { jam, phase, viewer } = data;
  const userId = viewer.userId;
  // Spec §4.2: while ONGOING the list is hidden; moderators see everything and a team still
  // sees its own entry.
  const restricted = jam.hideSubmissionsBeforeEnd && phase === "ONGOING" && !viewer.canModerate;
  if (restricted && !viewer.submission) return { hidden: true, ownOnly: false, entries: [], progress: null };

  const [rows, raterPairs, rater] = await Promise.all([
    db.submission.findMany({
      where: { jamId: jam.id, status: "SUBMITTED", visible: true, deletedAt: null },
      select: {
        id: true, title: true, coverUrl: true, supportedPlatforms: true, competing: true,
        rateable: true, status: true, createdAt: true,
        members: {
          select: { userId: true, isLeader: true, user: { select: { username: true, displayName: true } } },
          orderBy: { isLeader: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // One row per (submission, rater): ratings exist per criterion, raters are what count.
    db.rating.groupBy({
      by: ["submissionId", "userId"],
      where: { submission: { jamId: jam.id, status: "SUBMITTED", deletedAt: null } },
    }),
    userId && jam.ranked && phase === "RATING" ? loadRater(jam.id, userId) : Promise.resolve(null),
  ]);

  const raters = new Map<string, number>();
  const ratedByViewer = new Set<string>();
  for (const p of raterPairs) {
    raters.set(p.submissionId, (raters.get(p.submissionId) ?? 0) + 1);
    if (p.userId === userId) ratedByViewer.add(p.submissionId);
  }

  const all: EntryCard[] = rows.map((s) => {
    const isViewerTeam = Boolean(userId && s.members.some((m) => m.userId === userId));
    const eligible = rater
      ? canRate({
          phase, ranked: jam.ranked, eligibility: jam.ratingEligibility, rater,
          isOwnSubmission: isViewerTeam, submission: s,
        }).allowed
      : false;
    return {
      id: s.id, title: s.title, coverUrl: s.coverUrl, platforms: s.supportedPlatforms as Platform[],
      team: s.members.map((m) => ({ username: m.user.username, displayName: m.user.displayName, isLeader: m.isLeader })),
      competing: s.competing, rateable: s.rateable, raters: raters.get(s.id) ?? 0,
      ratedByViewer: ratedByViewer.has(s.id), isViewerTeam, eligible, createdAt: s.createdAt,
    };
  });

  const eligibleEntries = all.filter((e) => e.eligible);
  // No card for viewers who cannot rate anything (anonymous, ineligible, or outside RATING).
  const progress =
    rater && eligibleEntries.length > 0
      ? {
          rated: eligibleEntries.filter((e) => e.ratedByViewer).length,
          eligible: eligibleEntries.length,
          next: nextToRate(all),
        }
      : null;

  let entries = restricted ? all.filter((e) => e.isViewerTeam) : all;
  if (params.platforms.length) {
    entries = entries.filter((e) => e.platforms.some((p) => params.platforms.includes(p)));
  }
  if (params.hideRated) entries = entries.filter((e) => !e.ratedByViewer);
  entries = [...entries].sort((a, b) => {
    if (params.sort === "title") return a.title.localeCompare(b.title);
    if (params.sort === "fewest") return a.raters - b.raters || a.createdAt.getTime() - b.createdAt.getTime();
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return { hidden: false, ownOnly: restricted, entries, progress };
}
```

Run the integration test → PASS.

- [x] **Step 5: The Submissions tab page**

`src/app/jams/[slug]/submissions/page.tsx` (sibling of the existing `new/` folder):

- `generateMetadata` → `{ title: `Submissions — ${jam.name}` }` via `loadJamPage(slug, null)`.
- Load `auth()`, `loadJamPage(slug, userId)`, `notFound()` on `null`; parse the params with
  `parseEntriesParams(await searchParams, data.phase)`; `loadJamEntries(data, params)`.
- Render `<JamHeader data={data} active="submissions" />`, then (container, `pb-16 pt-6`):
  1. When `progress`: a card (`rounded-xl border bg-card p-5`, stacked on mobile) with
     "You've rated {rated} of {eligible} eligible entries", a `h-1 bg-track` bar filled
     `bg-rating` at `rated/eligible`, and either a primary link "Rate next game →" to
     `/submissions/{next}/rate` or, when `next` is `null`, "You've rated every game you can.
     Thanks!" in `text-muted-foreground`.
  2. Controls row: "Plays on" + platform toggle chips (links to `entriesHref` with the
     platform added/removed (`entriesHref(slug, phase, params, { … })`), `aria-current="true"` when active, `min-h-11 md:min-h-8`); during
     RATING a "Hide games I've rated" toggle link (same pattern); a Sort `<select>` in a small
     client component, or three links "Fewest ratings / Newest / Title" as a segmented group
     (choose links: no client JS).
  3. `hidden` → an empty-state card: "Submissions are hidden until the jam ends." When
     `ownOnly`, show a one-line note above the grid: "Only your entry is shown. Other games
     are hidden until the jam ends." Otherwise,
     no entries → "No submissions yet." (or "No games match these filters." with a "Clear
     filters" link when filters are active).
  4. Grid `grid gap-4 sm:grid-cols-2 lg:grid-cols-4` of cards: `relative` article; cover
     `<CoverImage src alt="" name={title} className="h-36 w-full border-b" />`; title as a
     stretched link to `/submissions/{id}`; "by {leader} +{n}" in `text-sm
     text-muted-foreground`; bottom row of platform tags (`font-mono text-[11px] border
     rounded px-1.5`, `platformLabel`) and a note: "Your team" (`text-brand`) when
     `isViewerTeam`, "✓ Rated" (`text-live`) when `ratedByViewer`, else — during RATING —
     "{raters} ratings" (`text-subtle-foreground`). Badges "Disqualified"
     (`!competing && !rateable`) and "Not competing" (`!competing && rateable`) as outline
     tags in the body.
- Delete `src/app/jams/[slug]/submission-list.tsx` and make sure nothing imports it
  (`grep -rn "submission-list" src`).

- [x] **Step 6: Verify**

Run: `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm test:integration && pnpm build`,
then e2e. Manual check against **Jam — submissions (rating)** at 1440px and 390px, both
themes: the rating jam from the seed signed in as an eligible participant, filters, "Rate next
game", and the hidden-list state on a live jam with `hideSubmissionsBeforeEnd`.

- [x] **Step 7: Commit**

```bash
git add src/lib/jam-entries.ts src/lib/jam-entries.test.ts src/lib/jam-entries-queries.ts tests/integration/jam-entries-queries.integration.test.ts "src/app/jams/[slug]/submissions/page.tsx" vitest.config.mts
git rm "src/app/jams/[slug]/submission-list.tsx"
git commit -m "feat(jam): submissions tab with rating progress and least-rated queue"
```

---

### Task 7: Submission page

**Files:**

- Modify: `src/app/submissions/[id]/page.tsx`, `src/app/submissions/[id]/loading.tsx`

**Interfaces:**

- Consumes: `CoverImage`, `initials`, `platformLabel` (Task 1); `getUserRatings`
  (`@/lib/rating-queries`); existing `SubmissionOwnerPanel`, `TeamManager`,
  `ModerationActions` (unchanged).

Visual reference: boards **Submission page** and **Submission — mobile**.

- [x] **Step 1: Keep every rule, change the layout**

All visibility and permission logic in the current page stays exactly as is (hidden, draft,
`hideSubmissionsBeforeEnd`, private fields, `canEdit`, `showRateButton`, team rules). Only the
markup changes:

- Container `mx-auto max-w-7xl px-4 py-8 md:px-12`. Breadcrumb `<nav aria-label="Breadcrumb">`:
  "{jam name} / Submissions / {title}" linking to `/jams/{slug}` and
  `/jams/{slug}/submissions` (`min-h-11 inline-flex items-center` on mobile).
- Grid `grid gap-10 md:grid-cols-12`:
  - Main (`md:col-span-8 flex flex-col gap-7`), with the aside's title block rendered
    **first on mobile** (`order-first md:order-none` on the aside's heading group, or render
    the heading block twice with `md:hidden` / `hidden md:block` — prefer `order`):
    - Cover: `<CoverImage src={coverUrl} alt={`Cover image of ${title}`} name={title} className="aspect-video w-full rounded-xl border" />`.
    - Screenshots: a `no-scrollbar` horizontal strip on mobile, `grid-cols-4` on desktop; each
      thumbnail is a link to the full image (`target="_blank" rel="noopener noreferrer"`) wrapping an
      `<img>` (`loading="lazy" referrerPolicy="no-referrer" alt="Screenshot {n} of {title}"`,
      `h-24 w-full object-cover rounded-lg border`).
    - "About the game" `<h2>` + `<Markdown>`.
    - "Submission info" `<dl>` (bordered, `rounded-xl`): one row per visible custom field; URL
      values as links with `rel="noopener noreferrer"`; a "Private" outline tag on private fields.
  - Aside (`md:col-span-4 flex flex-col gap-5`):
    - `<h1>` (`text-3xl font-semibold tracking-tight`) and badges: "Draft" (dashed outline),
      "Disqualified" (`text-destructive border-destructive`), "Not competing", "Hidden".
    - Primary "Play on itch.io ↗" (`h-11`, full width) when `itchUrl`; outline "Watch the
      video" when `videoUrl` (both `target="_blank" rel="noopener noreferrer"`).
    - Owner/moderator actions: "Edit" outline link when `canEdit`.
    - Details `<dl>`: Platforms (mono tags via `platformLabel`), Jam (link).
    - Team: rows with a 32px avatar (initials or `avatarUrl` — add `avatarUrl` to the member
      `user` select), display name link to `/users/{username}`, `@username` in
      `text-subtle-foreground`, "Leader" in `text-xs text-muted-foreground`.
    - Rating card (only when `showRateButton` or the viewer has ratings on it): heading "Your
      rating", "Open until {ratingEnd, UTC}" in `text-rating`, then either "Not rated yet. Play
      the game first, then score it on {n} criteria. Ratings are anonymous." + primary "Rate
      {title}" link, or — when `getUserRatings(id, userId)` returns rows — "You rated this game."
      + outline "Change your rating" link (only while `showRateButton`).
    - The existing `SubmissionOwnerPanel`, `TeamManager` and `ModerationActions` below, unchanged.
- The `hideSubmissionsBeforeEnd` early return becomes a centered empty state in the same style
  ("This game is hidden until the jam ends." + link back to the jam).

- [x] **Step 2: Loading skeleton**

`loading.tsx`: breadcrumb bar, a `aspect-video` muted block and a right column of muted blocks,
matching the new grid.

- [x] **Step 3: Verify**

Run: `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build`, then e2e. Manual
check against the boards at 1440px and 390px, both themes: a submitted game with cover,
screenshots, video and custom fields; a game without images (placeholders); as the team
(owner panel visible); as a moderator (private field visible); during RATING as an eligible
rater (rating card).

- [x] **Step 4: Commit**

```bash
git add "src/app/submissions/[id]/page.tsx" "src/app/submissions/[id]/loading.tsx"
git commit -m "feat(submission): redesigned submission page"
```

---

### Task 8: E2E checks, docs, review and wrap-up

**Files:**

- Modify: `tests/e2e/smoke.spec.ts`
- Modify: `docs/design-system.md`, `docs/codebase.md`, `docs/features.md`,
  `docs/agent/README.md`, `docs/backlog.md`, `CHANGELOG.md`
- Move: `docs/plans/redesign-discover-play.md` → `docs/plans/done/`

- [x] **Step 1: E2E checks**

Append inside the `smoke` describe:

```ts
test("jam list filters by status through the URL", async ({ page }) => {
  await page.goto("/jams?status=live");
  await expect(page.getByRole("link", { name: /Live/ }).first()).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Ongoing Jam" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Upcoming Jam" })).toHaveCount(0);
});

test("hostile list parameters fall back to the default list", async ({ page }) => {
  const response = await page.goto(`/jams?status=nope&show=99999&q=${"a".repeat(300)}`);
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { level: 1, name: "Jams" })).toBeVisible();
});

test("jam page has overview and submissions tabs", async ({ page }) => {
  await page.goto("/jams/ongoing-jam");
  const tabs = page.getByRole("navigation", { name: "Jam sections" });
  await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: /Submissions/ }).click();
  await expect(page).toHaveURL(/\/jams\/ongoing-jam\/submissions$/);
  await expect(tabs.getByRole("link", { name: /Submissions/ })).toHaveAttribute("aria-current", "page");
});
```

Adjust the seeded names if the seed differs (`grep -n "name:" prisma/seed.ts`). Run
`pnpm test:e2e` (or on port 3100 as in earlier tasks) → all pass.

- [x] **Step 2: Docs**

- `docs/design-system.md` — add `CoverImage`, `LinkTabs`, `JamCard`, `JamTimeline`, the
  `no-scrollbar` utility, and the image rule (external URLs, `no-referrer`, placeholder).
- `docs/codebase.md` — add the new `src/lib/*` modules (pure vs. queries), `jam-header.tsx`,
  the `submissions/page.tsx` tab, and remove `submission-list.tsx`.
- `docs/features.md` — update **Jam Browsing** ("status tabs with counts, search, tags,
  format and sort, paging") and add "**Jam submissions tab** | Filter by platform, hide rated
  games, least-rated-first 'Rate next game' | Medium".
- `docs/agent/README.md` — invariant: "Phase filters in SQL go through `jamPhaseWhere()`;
  never hand-write date conditions." Paths: the new loaders (integration-tested, excluded from
  unit coverage) and pure helpers.
- `docs/backlog.md` — Redesign: mark group 1 as done (link the done plan) and record anything
  deferred during this plan.
- `CHANGELOG.md` — under Unreleased → Changed: "Redesigned jam list, jam page and submission
  page; new Submissions tab on jams." Under Fixed: "Status filters on the jam list now run in
  the database, so filtered lists are complete."

- [x] **Step 3: Full verification**

Run: `pnpm lint && pnpm build && pnpm test && pnpm test:integration && pnpm test:e2e` → all
green. Every checkbox in this plan should already be ticked as each step was completed;
confirm none are left besides steps 4–5 of this task.

- [x] **Step 4: Peer review loop**

Run the review subagent on a small model: "You are a subAgent. Do not use
`vscode_askQuestions`. Do NOT edit code. Review the diff from the commit before Task 1 to HEAD
for correctness, edge cases, types/tests, architecture and docs gaps against
`docs/plans/redesign-discover-play.md`; return a structured list or LGTM." Fix every finding,
commit, and re-run until LGTM.

- [x] **Step 5: Move the plan and fix its links, in the final commit**

```bash
git mv docs/plans/redesign-discover-play.md docs/plans/done/redesign-discover-play.md
sed -i 's#](\.\./#](../../../#g' docs/plans/done/redesign-discover-play.md
git add docs/plans/done/redesign-discover-play.md docs tests/e2e/smoke.spec.ts CHANGELOG.md
git commit -m "docs: discover & play redesign wrap-up"
```
