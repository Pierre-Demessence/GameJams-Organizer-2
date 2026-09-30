# Redesign — Foundations, App Shell and Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the prototype look with the approved "calm dev-tool" design: dark-first
design tokens with a light variant, shared jam-status UI, a new site header with an account
menu, a new footer, and a rebuilt homepage.

**Architecture:** The design lives entirely in Tailwind v4 CSS variables in
`src/app/globals.css`, mapped onto the existing shadcn (`base-nova`) token names so every
existing component re-skins without edits. A small set of new tokens (`brand`, `live`,
`rating`, `finished`, `track`, `subtle-foreground`) covers jam status. Formatting and
status-mapping logic is pure TypeScript (unit-tested); React components stay thin.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, Tailwind CSS 4, shadcn `base-nova`
on `@base-ui/react`, `next-themes`, `next-auth` v5, Prisma 7, Vitest 5, Playwright.

**Spec:** Design canvas "GameJam Organizer — Website Design"
(<https://claude.ai/artifact/SPJeNxb9rsAiNeGNoeBXqB>, private to the owner). The boards this
plan implements: **Foundations**, **Header (shared component)**, **Header — account menu
open**, **Home — desktop**, **Home — mobile**. Product rules come from
[product-spec.md](../../specs/product-spec.md).

**Scope:** This plan covers the foundations, the app shell and the homepage only. The other
pages (jam listing, jam page, submissions, rating, results, profile, settings, admin,
organizer screens) are redesigned in follow-up plans, recorded in
[backlog.md](../../backlog.md#redesign).

## Global Constraints

- Colors (dark theme): background `#0B0C0E`, surface/card `#121316`, raised `#1A1B1F`,
  border `#24262B`, border strong/input `#34373E`, text `#EDEEF0`, muted `#9A9CA3`,
  subtle `#80838B`, brand (accent) `#8B97FF`, live `#3FB97A`, rating `#E0A63B`,
  finished `#8A8D95`, danger `#F2706A`, track `#1F2126`, primary button `#EDEEF0` on `#0B0C0E`.
- Colors (light theme): background `#FAFAFA`, surface/card `#FFFFFF`, raised `#F4F4F5`,
  border `#E4E4E7`, border strong/input `#D4D4D8`, text `#0B0C0E`, muted `#52555C`,
  subtle `#686B73`, brand `#4A5AE8`, live `#1C7F4B`, rating `#95600A`, finished `#5E616A`,
  danger `#C23A33`, track `#EBEBED`, primary button `#0B0C0E` on `#FFFFFF`.
- Fonts: Geist for all text, Geist Mono for dates, countdowns, scores and counts (both
  already loaded in `src/app/layout.tsx`).
- Default theme is **dark**; users can pick System, Dark or Light.
- Jam status labels shown to users: Draft, Upcoming, **Live** (the `ONGOING` phase), Rating,
  Finished.
- No emoji in UI chrome (the current `🎮` logo and `🔥 📅 🏆` section titles go).
- Touch targets are at least 44px on mobile; text contrast is at least 4.5:1.
- No user assets are hosted; images stay external URLs (spec §2).
- Results podiums only appear when `resultsArePublic()` is true (spec §6.5).

## Review Focus

1. **No live jams.** The homepage "Live now" panel must show an empty state with a link to
   the jam list, not an empty box. Pinned by Task 6 step 1 (`loadHomeData` returns `live: []`)
   and the empty-state branch in Task 6 step 5.
2. **Hidden results.** A finished ranked jam with `hideResults` on and no reveal must not
   leak its podium on the homepage. Pinned by the integration test in Task 6 step 1.
3. **Old sessions without `username`.** Tokens issued before Task 4 have no `username`; the
   account menu must hide "Your profile" instead of linking to `/users/undefined`. Pinned by
   the unit test in Task 4 step 1.
4. **Countdown edges.** Past deadlines, exactly one day, and a zero-length window must format
   without `NaN` or negative numbers. Pinned by the tests in Task 2 step 1.
5. **Theme choice.** With no stored preference the page is dark; with a stored `light`
   preference it is light, with no `dark` class. Pinned by the two e2e checks in Task 7
   step 1. (The account-menu picker itself needs a signed-in e2e session, which the smoke
   suite does not have; it is checked manually in Task 5 step 5.)

## Known limitation

Until the follow-up plans ship, pages that are not redesigned yet keep their
`container mx-auto px-4` width while the new header and footer use `max-w-7xl`, so content
and chrome edges do not line up on wide screens.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/app/globals.css` | Design tokens (light in `:root`, dark in `.dark`), Tailwind mappings |
| `src/components/theme-provider.tsx` | `defaultTheme="dark"` |
| `src/lib/jam-status-display.ts` | Pure: phase → label/tone, deadlines, progress, time formatting |
| `src/lib/jam-status-display.test.ts` | Unit tests for the above |
| `src/components/jam/jam-status-badge.tsx` | Status pill (dot + label) |
| `src/components/jam/jam-progress.tsx` | Thin phase progress bar |
| `src/components/jam/countdown.tsx` | Client-side ticking countdown |
| `src/components/logo.tsx` | Logo mark + wordmark |
| `src/components/site-header.tsx` | Header (replaces `navbar.tsx`) |
| `src/components/user-menu.tsx` | Account menu (profile, settings, theme, sign out) |
| `src/components/theme-menu-items.tsx` | Theme radio group used inside the account menu |
| `src/components/footer.tsx` | New footer |
| `src/lib/auth.ts`, `src/types/next-auth.d.ts` | `username` on the session |
| `src/domain/results.ts` (+ test) | `podium()` selector |
| `src/lib/home-queries.ts` | `loadHomeData()` — all homepage reads |
| `tests/integration/home-queries.integration.test.ts` | Hidden-results and empty-state checks |
| `src/app/page.tsx` | Homepage |
| `tests/e2e/smoke.spec.ts` | Theme and homepage smoke checks |
| `docs/design-system.md` | Human reference for tokens and components |

---

### Task 1: Design tokens and dark default

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/components/theme-provider.tsx`

**Interfaces:**

- Produces: Tailwind utilities `bg-brand`, `text-brand`, `bg-live`, `text-live`, `bg-rating`,
  `text-rating`, `bg-finished`, `text-finished`, `bg-track`, `text-subtle-foreground`, plus
  opacity forms such as `bg-live/12`. Existing shadcn names (`bg-card`, `text-muted-foreground`,
  `border-border`, `bg-primary` …) keep working with the new colors.

- [x] **Step 1: Add the new token mappings to `@theme inline`**

Insert after `--font-mono: var(--font-geist-mono);`:

```css
  --color-brand: var(--brand);
  --color-live: var(--live);
  --color-rating: var(--rating);
  --color-finished: var(--finished);
  --color-track: var(--track);
  --color-subtle-foreground: var(--subtle-foreground);
```

- [x] **Step 2: Replace the `:root` (light) color values**

Keep the `--chart-*` and `--sidebar-*` lines as they are; replace the others and add the new
tokens:

```css
:root {
  --background: #fafafa;
  --foreground: #0b0c0e;
  --card: #ffffff;
  --card-foreground: #0b0c0e;
  --popover: #ffffff;
  --popover-foreground: #0b0c0e;
  --primary: #0b0c0e;
  --primary-foreground: #ffffff;
  --secondary: #f4f4f5;
  --secondary-foreground: #0b0c0e;
  --muted: #f4f4f5;
  --muted-foreground: #52555c;
  --subtle-foreground: #686b73;
  --accent: #f4f4f5;
  --accent-foreground: #0b0c0e;
  --destructive: #c23a33;
  --border: #e4e4e7;
  --input: #d4d4d8;
  --ring: #4a5ae8;
  --brand: #4a5ae8;
  --live: #1c7f4b;
  --rating: #95600a;
  --finished: #5e616a;
  --track: #ebebed;
  --radius: 0.5rem;
  /* --chart-* and --sidebar-* unchanged */
}
```

- [x] **Step 3: Replace the `.dark` color values**

```css
.dark {
  --background: #0b0c0e;
  --foreground: #edeef0;
  --card: #121316;
  --card-foreground: #edeef0;
  --popover: #121316;
  --popover-foreground: #edeef0;
  --primary: #edeef0;
  --primary-foreground: #0b0c0e;
  --secondary: #1a1b1f;
  --secondary-foreground: #edeef0;
  --muted: #1a1b1f;
  --muted-foreground: #9a9ca3;
  --subtle-foreground: #80838b;
  --accent: #1a1b1f;
  --accent-foreground: #edeef0;
  --destructive: #f2706a;
  --border: #24262b;
  --input: #34373e;
  --ring: #8b97ff;
  --brand: #8b97ff;
  --live: #3fb97a;
  --rating: #e0a63b;
  --finished: #8a8d95;
  --track: #1f2126;
  /* --chart-* and --sidebar-* unchanged */
}
```

Note: `--radius` drops from `0.625rem` to `0.5rem`, which tightens the corners of every
existing shadcn component (buttons 8px, cards `rounded-xl` about 11px). This is intended.

- [x] **Step 4: Make dark the default theme**

`src/components/theme-provider.tsx`:

```tsx
<NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
```

- [x] **Step 5: Verify**

Run: `pnpm lint && pnpm build`
Expected: both succeed. Then `pnpm dev`, open `/` in a fresh private window: the page is dark
on first paint; body text is `#EDEEF0` on `#0B0C0E` (check with devtools).

- [x] **Step 6: Commit**

```bash
git add src/app/globals.css src/components/theme-provider.tsx docs/plans/redesign-foundations.md docs/backlog.md
git commit -m "feat(ui): add dark-first design tokens"
```

---

### Task 2: Jam status display helpers

**Files:**

- Create: `src/lib/jam-status-display.ts`
- Test: `src/lib/jam-status-display.test.ts`

**Interfaces:**

- Consumes: `JamPhase`, `JamPhaseInput` from `@/domain/jam-phase`.
- Produces:
  - `type JamStatusTone = "draft" | "upcoming" | "live" | "rating" | "finished"`
  - `jamStatus(phase: JamPhase): { label: string; tone: JamStatusTone }`
  - `TONE_TEXT`, `TONE_BG`, `TONE_PILL`: `Record<JamStatusTone, string>` (Tailwind classes)
  - `nextDeadline(jam: JamPhaseInput, phase: JamPhase): { label: string; at: Date } | null` —
    labels are `"Starts"`, `"Submissions close"`, `"Rating closes"`; callers add `" in"`
    where the sentence needs it
  - `phaseProgress(jam: JamPhaseInput, phase: JamPhase, now?: Date): number` (0–100)
  - `formatCountdown(ms: number): string` → `"2d 06:14:09"` / `"18:02:51"`
  - `formatTimeLeftShort(ms: number): string` → `"9d 03h"` / `"05h 12m"`
  - `formatDuration(start: Date, end: Date): string` → `"72 hours"` / `"7 days"`

- [x] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  TONE_BG,
  TONE_PILL,
  TONE_TEXT,
  formatCountdown,
  formatDuration,
  formatTimeLeftShort,
  jamStatus,
  nextDeadline,
  phaseProgress,
} from "@/lib/jam-status-display";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const base = new Date("2026-10-01T00:00:00Z");
const at = (offsetMs: number) => new Date(base.getTime() + offsetMs);

const jam = {
  publishedAt: at(-10 * DAY),
  startDate: at(-2 * DAY),
  endDate: at(2 * DAY),
  ratingEnd: at(6 * DAY),
  ranked: true,
};

describe("jamStatus", () => {
  it("shows ONGOING as Live", () => {
    expect(jamStatus("ONGOING")).toEqual({ label: "Live", tone: "live" });
  });
  it("maps every other phase", () => {
    expect(jamStatus("DRAFT").label).toBe("Draft");
    expect(jamStatus("UPCOMING").tone).toBe("upcoming");
    expect(jamStatus("RATING").tone).toBe("rating");
    expect(jamStatus("FINISHED").label).toBe("Finished");
  });
  it("has classes for every tone", () => {
    for (const map of [TONE_TEXT, TONE_BG, TONE_PILL]) {
      expect(Object.keys(map).sort()).toEqual(["draft", "finished", "live", "rating", "upcoming"]);
    }
    expect(TONE_TEXT.live).toBe("text-live");
  });
});

describe("nextDeadline", () => {
  it("counts to the start while upcoming", () => {
    expect(nextDeadline(jam, "UPCOMING")).toEqual({ label: "Starts", at: jam.startDate });
  });
  it("counts to the end while live", () => {
    expect(nextDeadline(jam, "ONGOING")).toEqual({ label: "Submissions close", at: jam.endDate });
  });
  it("counts to rating end while rating", () => {
    expect(nextDeadline(jam, "RATING")).toEqual({ label: "Rating closes", at: jam.ratingEnd });
  });
  it("has no deadline when finished, draft, or missing dates", () => {
    expect(nextDeadline(jam, "FINISHED")).toBeNull();
    expect(nextDeadline(jam, "DRAFT")).toBeNull();
    expect(nextDeadline({ ...jam, ratingEnd: null }, "RATING")).toBeNull();
  });
});

describe("phaseProgress", () => {
  it("is halfway through a live jam at its midpoint", () => {
    expect(phaseProgress(jam, "ONGOING", base)).toBe(50);
  });
  it("tracks the rating window separately", () => {
    expect(phaseProgress(jam, "RATING", at(4 * DAY))).toBe(50);
  });
  it("is 0 before start and 100 when finished", () => {
    expect(phaseProgress(jam, "UPCOMING", base)).toBe(0);
    expect(phaseProgress(jam, "FINISHED", base)).toBe(100);
  });
  it("clamps and survives a zero-length window", () => {
    const flat = { ...jam, startDate: base, endDate: base };
    expect(phaseProgress(flat, "ONGOING", base)).toBe(100);
    expect(phaseProgress(jam, "ONGOING", at(10 * DAY))).toBe(100);
  });
});

describe("formatCountdown", () => {
  it("shows days when at least one day is left", () => {
    expect(formatCountdown(2 * DAY + 6 * HOUR + 14 * 60_000 + 9_000)).toBe("2d 06:14:09");
    expect(formatCountdown(DAY)).toBe("1d 00:00:00");
  });
  it("drops the day part under a day", () => {
    expect(formatCountdown(18 * HOUR + 2 * 60_000 + 51_000)).toBe("18:02:51");
  });
  it("never goes negative", () => {
    expect(formatCountdown(-5_000)).toBe("00:00:00");
    expect(formatCountdown(Number.NaN)).toBe("00:00:00");
  });
});

describe("formatTimeLeftShort", () => {
  it("uses days and hours, or hours and minutes", () => {
    expect(formatTimeLeftShort(9 * DAY + 3 * HOUR)).toBe("9d 03h");
    expect(formatTimeLeftShort(5 * HOUR + 12 * 60_000)).toBe("05h 12m");
    expect(formatTimeLeftShort(-1)).toBe("00h 00m");
  });
});

describe("formatDuration", () => {
  it("uses hours up to 72 and days beyond", () => {
    expect(formatDuration(base, at(48 * HOUR))).toBe("48 hours");
    expect(formatDuration(base, at(72 * HOUR))).toBe("72 hours");
    expect(formatDuration(base, at(7 * DAY))).toBe("7 days");
    expect(formatDuration(base, at(1 * HOUR))).toBe("1 hour");
  });
  it("rounds partial days and never goes negative", () => {
    expect(formatDuration(base, at(3.6 * DAY))).toBe("4 days");
    expect(formatDuration(base, base)).toBe("0 hours");
    expect(formatDuration(at(5 * HOUR), base)).toBe("0 hours");
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/jam-status-display.test.ts`
Expected: FAIL — cannot resolve `@/lib/jam-status-display`.

- [x] **Step 3: Implement**

```ts
import type { JamPhase, JamPhaseInput } from "@/domain/jam-phase";

export type JamStatusTone = "draft" | "upcoming" | "live" | "rating" | "finished";

const STATUS: Record<JamPhase, { label: string; tone: JamStatusTone }> = {
  DRAFT: { label: "Draft", tone: "draft" },
  UPCOMING: { label: "Upcoming", tone: "upcoming" },
  ONGOING: { label: "Live", tone: "live" },
  RATING: { label: "Rating", tone: "rating" },
  FINISHED: { label: "Finished", tone: "finished" },
};

export function jamStatus(phase: JamPhase) {
  return STATUS[phase];
}

export const TONE_TEXT: Record<JamStatusTone, string> = {
  draft: "text-muted-foreground",
  upcoming: "text-brand",
  live: "text-live",
  rating: "text-rating",
  finished: "text-finished",
};

export const TONE_BG: Record<JamStatusTone, string> = {
  draft: "bg-muted-foreground",
  upcoming: "bg-brand",
  live: "bg-live",
  rating: "bg-rating",
  finished: "bg-finished",
};

export const TONE_PILL: Record<JamStatusTone, string> = {
  draft: "border border-dashed border-input",
  upcoming: "bg-brand/12",
  live: "bg-live/12",
  rating: "bg-rating/12",
  finished: "bg-finished/15",
};

export function nextDeadline(
  jam: JamPhaseInput,
  phase: JamPhase
): { label: string; at: Date } | null {
  if (phase === "UPCOMING" && jam.startDate) return { label: "Starts", at: jam.startDate };
  if (phase === "ONGOING" && jam.endDate) return { label: "Submissions close", at: jam.endDate };
  if (phase === "RATING" && jam.ratingEnd) return { label: "Rating closes", at: jam.ratingEnd };
  return null;
}

function windowProgress(from: Date | null, to: Date | null, now: Date): number {
  if (!from || !to) return 0;
  const span = to.getTime() - from.getTime();
  if (span <= 0) return 100;
  const pct = ((now.getTime() - from.getTime()) / span) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function phaseProgress(jam: JamPhaseInput, phase: JamPhase, now = new Date()): number {
  if (phase === "ONGOING") return windowProgress(jam.startDate, jam.endDate, now);
  if (phase === "RATING") return windowProgress(jam.endDate, jam.ratingEnd, now);
  if (phase === "FINISHED") return 100;
  return 0;
}

const pad = (n: number) => String(n).padStart(2, "0");

function parts(ms: number) {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

export function formatCountdown(ms: number): string {
  const { days, hours, minutes, seconds } = parts(ms);
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

export function formatTimeLeftShort(ms: number): string {
  const { days, hours, minutes } = parts(ms);
  return days > 0 ? `${days}d ${pad(hours)}h` : `${pad(hours)}h ${pad(minutes)}m`;
}

export function formatDuration(start: Date, end: Date): string {
  const hours = Math.max(0, Math.round((end.getTime() - start.getTime()) / 3_600_000));
  if (hours <= 72) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${Math.round(hours / 24)} days`;
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/jam-status-display.test.ts`
Expected: PASS (all tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/jam-status-display.ts src/lib/jam-status-display.test.ts
git commit -m "feat(ui): add jam status and countdown formatting helpers"
```

---

### Task 3: Jam status components

**Files:**

- Create: `src/components/jam/jam-status-badge.tsx`
- Create: `src/components/jam/jam-progress.tsx`
- Create: `src/components/jam/countdown.tsx`

**Interfaces:**

- Consumes: `jamStatus`, `formatCountdown`, `TONE_TEXT`, `TONE_BG`, `TONE_PILL` (Task 2);
  tokens (Task 1).
- Produces:
  - `<JamStatusBadge phase={JamPhase} className? />`
  - `<JamProgress phase={JamPhase} value={number} className? />`
  - `<Countdown to={string /* ISO date */} className? />` (client component; refreshes the
    route once when it reaches zero, so the phase and lists update)

- [x] **Step 1: Status badge**

```tsx
import type { JamPhase } from "@/domain/jam-phase";
import { TONE_PILL, TONE_TEXT, jamStatus } from "@/lib/jam-status-display";
import { cn } from "@/lib/utils";

export function JamStatusBadge({ phase, className }: { phase: JamPhase; className?: string }) {
  const { label, tone } = jamStatus(phase);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        TONE_PILL[tone],
        TONE_TEXT[tone],
        className
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
```

- [x] **Step 2: Progress bar**

```tsx
import type { JamPhase } from "@/domain/jam-phase";
import { TONE_BG, jamStatus } from "@/lib/jam-status-display";
import { cn } from "@/lib/utils";

export function JamProgress({
  phase,
  value,
  className,
}: {
  phase: JamPhase;
  value: number;
  className?: string;
}) {
  const { label, tone } = jamStatus(phase);
  return (
    <div
      role="progressbar"
      aria-label={`${label} progress`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn("h-0.75 overflow-hidden rounded-full bg-track", className)}
    >
      <div className={cn("h-full", TONE_BG[tone])} style={{ width: `${value}%` }} />
    </div>
  );
}
```

- [x] **Step 3: Countdown**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCountdown } from "@/lib/jam-status-display";
import { cn } from "@/lib/utils";

export function Countdown({ to, className }: { to: string; className?: string }) {
  const router = useRouter();
  const target = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());
  const refreshed = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // The phase is derived from dates on the server; re-render once the deadline passes.
    if (now >= target && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [now, target, router]);

  return (
    // Server and client clocks differ by a second or so; the client value wins.
    <time dateTime={to} suppressHydrationWarning className={cn("font-mono tabular-nums", className)}>
      {formatCountdown(target - now)}
    </time>
  );
}
```

- [x] **Step 4: Verify**

Run: `pnpm lint && pnpm exec tsc --noEmit`
Expected: no errors. (These components are exercised visually in Task 6.)

- [x] **Step 5: Commit**

```bash
git add src/components/jam
git commit -m "feat(ui): add jam status badge, progress bar and countdown"
```

---

### Task 4: Username on the session, account menu

**Files:**

- Modify: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth.ts` (the `jwt` and `session` callbacks)
- Create: `src/components/theme-menu-items.tsx`
- Modify: `src/components/user-menu.tsx`
- Test: `src/components/user-menu.test.ts`

**Interfaces:**

- Produces: `session.user.username?: string | null`;
  `<UserMenu user={{ name?, email?, image?, username? }} />`.

- [x] **Step 1: Update the failing tests**

Add next to the existing `vi.mock("next-auth/react", …)`:

```ts
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark", setTheme: vi.fn() }) }));
```

Replace the `describe("UserMenu", …)` block with:

```ts
describe("UserMenu", () => {
  beforeEach(() => {
    signOutMock.mockReset();
  });

  const linkHref = (node: ElementWithProps): string | undefined =>
    isValidElement(node.props.render)
      ? ((node.props.render as ElementWithProps).props.href as string | undefined)
      : undefined;

  it("triggers signOut when clicking Sign out", () => {
    const menu = UserMenu({ user: { name: "Test User", username: "tester" } });
    // The item renders an icon before its label, so children is an array.
    const item = findElement(
      menu,
      (node) =>
        typeof node.props.onClick === "function" &&
        Children.toArray(node.props.children).includes("Sign out")
    );
    expect(item).toBeDefined();
    (item?.props.onClick as () => void)();
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("links to the user's profile when the username is known", () => {
    const menu = UserMenu({ user: { name: "Test User", username: "tester" } });
    expect(findElement(menu, (n) => linkHref(n) === "/users/tester")).toBeDefined();
    expect(findElement(menu, (n) => linkHref(n) === "/settings")).toBeDefined();
  });

  it("hides the profile link for sessions without a username", () => {
    const menu = UserMenu({ user: { name: "Test User" } });
    expect(findElement(menu, (n) => linkHref(n)?.startsWith("/users/") ?? false)).toBeUndefined();
    expect(findElement(menu, (n) => linkHref(n) === "/settings")).toBeDefined();
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `pnpm test src/components/user-menu.test.ts`
Expected: FAIL — "Sign out" not found (current label is "Sign Out") and no `/users/tester` link.

- [x] **Step 3: Add `username` to the session**

`src/types/next-auth.d.ts` — add `username?: string | null;` to `Session["user"]` and to `JWT`.

`src/lib/auth.ts`, replace the `jwt` callback:

```ts
async jwt({ token, user, account, trigger }) {
  if (user) {
    token.id = user.id;
    if (user.id) token.isStaff = await isStaff(user.id);
  }
  if (account) {
    token.provider = account.provider;
  }
  // Loaded lazily so tokens issued before this field existed pick it up on their next
  // request; refreshed on `update()` so a username change in settings shows at once.
  if (token.id && (token.username === undefined || trigger === "update")) {
    const row = await db.user.findUnique({
      where: { id: token.id },
      select: { username: true },
    });
    token.username = row?.username ?? null;
  }
  return token;
},
```

and in `session`, after the `isStaff` line: `session.user.username = token.username ?? null;`

The settings page does not call `update()` yet; recording that is part of Task 7 step 3.

- [x] **Step 4: Theme radio items**

`src/components/theme-menu-items.tsx`:

```tsx
"use client";

import { useTheme } from "next-themes";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="text-xs text-subtle-foreground">Theme</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={theme ?? "dark"} onValueChange={(v) => setTheme(String(v))}>
        {OPTIONS.map((o) => (
          <DropdownMenuRadioItem key={o.value} value={o.value}>
            {o.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}
```

- [x] **Step 5: Rewrite the account menu**

`src/components/user-menu.tsx`:

```tsx
"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDownIcon, LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeMenuItems } from "@/components/theme-menu-items";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const display = user.username ?? user.name ?? user.email ?? "?";
  const initials = display.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex min-h-11 items-center gap-2 rounded-full border border-border py-0 pr-2 pl-1 text-sm hover:bg-muted aria-expanded:bg-muted md:min-h-9"
      >
        <Avatar className="size-7">
          <AvatarImage src={user.image ?? undefined} alt="" />
          <AvatarFallback className="text-xs text-brand">{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate sm:inline">{display}</span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex flex-col gap-0.5 px-2 py-2">
          {user.name && <p className="text-sm font-semibold">{user.name}</p>}
          {user.username && (
            <p className="text-xs text-subtle-foreground">@{user.username}</p>
          )}
        </div>
        <DropdownMenuSeparator />
        {user.username && (
          <DropdownMenuItem render={<Link href={`/users/${user.username}`} />}>
            <UserIcon />
            Your profile
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link href="/settings" />}>
          <SettingsIcon />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ThemeMenuItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [x] **Step 6: Run the tests to verify they pass**

Run: `pnpm test src/components/user-menu.test.ts`
Expected: PASS (3 tests).

- [x] **Step 7: Commit**

```bash
git add src/types/next-auth.d.ts src/lib/auth.ts src/components/theme-menu-items.tsx src/components/user-menu.tsx src/components/user-menu.test.ts
git commit -m "feat(ui): account menu with profile, settings, theme and sign out"
```

---

### Task 5: Site header and footer

**Files:**

- Create: `src/components/logo.tsx`
- Create: `src/components/site-header.tsx`
- Delete: `src/components/navbar.tsx`
- Modify: `src/components/footer.tsx`
- Modify: `src/app/layout.tsx` (import `SiteHeader` instead of `Navbar`)

**Interfaces:**

- Consumes: `UserMenu` (Task 4), `ThemeToggle` (existing; signed-out users, `md` and up).
- Produces: `<Logo />`, `<SiteHeader />`, `<Footer />`.

- [x] **Step 1: Logo**

```tsx
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex min-h-11 items-center gap-2.5 font-semibold tracking-tight">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" />
        <rect x="12" y="12" width="6" height="6" rx="1.5" className="fill-brand" />
      </svg>
      <span>GameJam Organizer</span>
    </Link>
  );
}
```

- [x] **Step 2: Header**

The header is responsive: from `md` up it shows the nav, the search field, and either the
account menu or theme toggle + Sign in + Sign up. Below `md` it shows the logo, a search icon,
the account menu (signed in) and a menu sheet that holds the nav links and, for signed-out
users, Sign in and Sign up. Sheet links close the sheet (`SheetClose`) because the header
persists across client navigations.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { MenuIcon, SearchIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const SHEET_LINK = "flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted";

export function SiteHeader() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const signedIn = Boolean(session?.user);
  const links = [
    {
      href: "/jams",
      label: "Jams",
      active: pathname === "/jams" || (pathname.startsWith("/jams/") && pathname !== "/jams/new"),
    },
    { href: "/jams/new", label: "Host a jam", active: pathname === "/jams/new" },
    ...(session?.user?.isStaff
      ? [{ href: "/admin", label: "Admin", active: pathname.startsWith("/admin") }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 pr-2 pl-4 md:h-15 md:px-12">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 text-sm md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground",
                l.active && "bg-muted text-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <Link
            href="/jams"
            className="hidden h-9 w-60 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-subtle-foreground md:flex"
          >
            <SearchIcon className="size-4" />
            Search jams…
          </Link>
          <Link
            href="/jams"
            aria-label="Search jams"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "size-11 md:hidden")}
          >
            <SearchIcon />
          </Link>
          {status === "loading" ? (
            <div className="h-9 w-24 animate-pulse rounded-full bg-muted" aria-hidden />
          ) : signedIn ? (
            <UserMenu user={session!.user} />
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <ThemeToggle />
              <Link href="/sign-in" className={cn(buttonVariants({ variant: "ghost" }), "h-9")}>
                Sign in
              </Link>
              <Link href="/sign-up" className={cn(buttonVariants(), "h-9 px-3.5")}>
                Sign up
              </Link>
            </div>
          )}
          <Sheet>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label="Open menu"
                  className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "size-11 md:hidden")}
                />
              }
            >
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="right" className="data-[side=right]:w-72">
              <SheetTitle className="px-4 pt-4">Menu</SheetTitle>
              <nav aria-label="Mobile" className="flex flex-col p-2">
                {links.map((l) => (
                  <SheetClose nativeButton={false} key={l.href} render={<Link href={l.href} className={SHEET_LINK} />}>
                    {l.label}
                  </SheetClose>
                ))}
                {!signedIn && status !== "loading" && (
                  <>
                    <SheetClose nativeButton={false} render={<Link href="/sign-in" className={SHEET_LINK} />}>
                      Sign in
                    </SheetClose>
                    <SheetClose nativeButton={false} render={<Link href="/sign-up" className={SHEET_LINK} />}>
                      Sign up
                    </SheetClose>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
```

Signed-out mobile users change the theme from the menu sheet (`ThemeButtons`); the theme
picker lives in the account menu for signed-in users.

- [x] **Step 3: Footer**

```tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-subtle-foreground md:flex-row md:items-center md:gap-3 md:px-12">
        <p className="md:flex-1">
          GameJam Organizer — free for everyone. We link to your games; we never host them.
        </p>
        <nav aria-label="Footer" className="flex gap-5">
          <Link href="/jams" className="flex min-h-11 items-center hover:text-foreground md:min-h-0">Jams</Link>
          <Link href="/jams/new" className="flex min-h-11 items-center hover:text-foreground md:min-h-0">Host a jam</Link>
          <a
            href="https://github.com/Pierre-Demessence/GameJams-Organizer-2"
            className="flex min-h-11 items-center hover:text-foreground md:min-h-0"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
```

- [x] **Step 4: Wire into the layout**

In `src/app/layout.tsx` replace `import { Navbar } from "@/components/navbar";` with
`import { SiteHeader } from "@/components/site-header";` and `<Navbar />` with `<SiteHeader />`.
Delete `src/components/navbar.tsx` (`git rm`). Confirm nothing else imports it:
`grep -rn "components/navbar" src tests` → no output.

- [x] **Step 5: Verify**

Run: `pnpm lint && pnpm exec tsc --noEmit && pnpm test`
Expected: all pass. Then in `pnpm dev`, check by hand:

- Signed out, 1440px: theme toggle, Sign in, Sign up. Signed out, 390px: logo, search icon,
  menu; the sheet lists Jams, Host a jam, Sign in, Sign up and closes when a link is tapped;
  no horizontal overflow.
- Signed in: the account chip opens the menu; "Your profile" goes to `/users/<username>`;
  choosing Light / Dark / System in the menu switches the theme and the radio shows the
  stored choice after a reload.
- Every tap target at 390px is at least 44px tall (devtools → inspect).

- [x] **Step 6: Commit**

```bash
git add src/components/logo.tsx src/components/site-header.tsx src/components/footer.tsx src/app/layout.tsx
git rm src/components/navbar.tsx
git commit -m "feat(ui): new site header and footer"
```

---

### Task 6: Homepage

**Files:**

- Modify: `src/domain/results.ts`, `src/domain/results.test.ts`
- Create: `src/lib/home-queries.ts`
- Create: `tests/integration/home-queries.integration.test.ts`
- Modify: `src/app/page.tsx`
- Modify: `vitest.config.mts` (exclude `src/lib/home-queries.ts` from unit coverage, next to
  `src/lib/scoring.ts`)

**Interfaces:**

- Consumes: `jamPhase`, `resultsArePublic`, `loadJamResults`, Task 2 helpers, Task 3
  components.
- Produces:
  - `podium(results: JamResults, size?: number): SubmissionResult[]` in `@/domain/results`
  - `loadHomeData(now?: Date): Promise<HomeData>` in `@/lib/home-queries`, where

```ts
export interface HomeJam {
  id: string;
  slug: string;
  name: string;
  shortDesc: string;
  phase: JamPhase;
  ranked: boolean;
  publishedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  ratingEnd: Date | null;
  joined: number;
  entries: number;
}
export interface PodiumEntry {
  place: number;
  submissionId: string;
  title: string;
  score: number | null;
}
export interface FinishedJam extends HomeJam {
  // null while results are not public (or for showcase jams); [] when nobody was rated.
  podium: PodiumEntry[] | null;
  // Distinct (rater, submission) pairs, i.e. "games rated", not per-criterion scores.
  ratings: number;
}
export interface HomeData {
  live: HomeJam[];
  upcoming: HomeJam[];
  finished: FinishedJam[];
}
```

- [x] **Step 1: Write the failing tests**

In `src/domain/results.test.ts`, extend the existing import from `@/domain/results` with
`podium`, add `import type { JamResults, SubmissionResult } from "@/domain/scoring";` to the
imports at the top, and append:

```ts
const entry = (id: string, rank: number | null, totalRatings = 10): SubmissionResult => ({
  submissionId: id,
  competing: rank !== null,
  rank,
  finalScore: rank === null ? null : 5 - rank / 10,
  totalRatings,
  rawAverage: 4,
  criteriaScores: {},
});

describe("podium", () => {
  it("returns the top three competing entries in rank order", () => {
    const results: JamResults = {
      hasOverall: true,
      competing: [entry("d", 4), entry("b", 2), entry("a", 1), entry("c", 3)],
      notCompeting: [entry("x", null)],
    };
    expect(podium(results).map((r) => r.submissionId)).toEqual(["a", "b", "c"]);
  });
  it("skips entries nobody rated", () => {
    const results: JamResults = {
      hasOverall: true,
      competing: [entry("a", 1, 0), entry("b", 2), entry("c", 3, 0)],
      notCompeting: [],
    };
    expect(podium(results).map((r) => r.submissionId)).toEqual(["b"]);
  });
  it("is empty when the jam has no overall ranking", () => {
    expect(podium({ hasOverall: false, competing: [entry("a", null)], notCompeting: [] })).toEqual([]);
  });
});
```

Create `tests/integration/home-queries.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { loadHomeData } from "@/lib/home-queries";
import { createJam, createSubmission, createUser, daysFromNow } from "./factories";

async function rate(submissionId: string, criterionId: string, userId: string, score: number) {
  await db.rating.create({ data: { submissionId, criterionId, userId, score } });
}

describe("loadHomeData", () => {
  it("lists only published, public, non-deleted jams", async () => {
    const owner = await createUser();
    await createJam(owner.id, { visibility: "PUBLIC", startDate: daysFromNow(1), endDate: daysFromNow(2) });
    await createJam(owner.id, {
      visibility: "UNLISTED", publishedAt: daysFromNow(-1), startDate: daysFromNow(1), endDate: daysFromNow(2),
    });
    const deleted = await createJam(owner.id, {
      visibility: "PUBLIC", publishedAt: daysFromNow(-1), startDate: daysFromNow(1), endDate: daysFromNow(2),
    });
    await db.jam.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    expect(await loadHomeData()).toEqual({ live: [], upcoming: [], finished: [] });
  });

  it("orders live and rating jams by their next deadline", async () => {
    const owner = await createUser();
    const rating = await createJam(owner.id, {
      visibility: "PUBLIC", ranked: true, publishedAt: daysFromNow(-3), startDate: daysFromNow(-2),
      endDate: daysFromNow(-1), ratingEnd: daysFromNow(2),
    });
    const live = await createJam(owner.id, {
      visibility: "PUBLIC", publishedAt: daysFromNow(-2), startDate: daysFromNow(-1), endDate: daysFromNow(1),
    });
    const data = await loadHomeData();
    expect(data.live.map((j) => [j.id, j.phase])).toEqual([
      [live.id, "ONGOING"],
      [rating.id, "RATING"],
    ]);
  });

  it("hides the podium until results are public, then shows rated visible entries", async () => {
    const owner = await createUser();
    const [r1, r2] = [await createUser(), await createUser()];
    const jam = await createJam(owner.id, {
      visibility: "PUBLIC", ranked: true, publishedAt: daysFromNow(-5), startDate: daysFromNow(-4),
      endDate: daysFromNow(-3), ratingEnd: daysFromNow(-1),
    });
    const criterion = await db.criterion.create({ data: { jamId: jam.id, name: "Fun" } });
    const best = await createSubmission(jam.id, owner.id, { title: "Best" });
    const good = await createSubmission(jam.id, r1.id, { title: "Good" });
    const hidden = await createSubmission(jam.id, r2.id, { title: "Hidden" });
    await db.submission.updateMany({
      where: { id: { in: [best.id, good.id, hidden.id] } },
      data: { status: "SUBMITTED" },
    });
    await db.submission.update({ where: { id: hidden.id }, data: { visible: false } });
    await rate(best.id, criterion.id, r1.id, 5);
    await rate(best.id, criterion.id, r2.id, 5);
    await rate(good.id, criterion.id, r2.id, 3);
    await rate(hidden.id, criterion.id, r1.id, 5);
    await rate(hidden.id, criterion.id, owner.id, 5);
    await db.jam.update({ where: { id: jam.id }, data: { hideResults: true } });

    const before = await loadHomeData();
    expect(before.finished.map((j) => j.id)).toEqual([jam.id]);
    expect(before.finished[0].podium).toBeNull();

    await db.jam.update({ where: { id: jam.id }, data: { resultsRevealedAt: new Date() } });
    const after = await loadHomeData();
    expect(after.finished[0].podium?.map((p) => p.title)).toEqual(["Best", "Good"]);
    expect(after.finished[0].podium?.map((p) => p.place)).toEqual([1, 2]);
    expect(after.finished[0].ratings).toBe(5);
  });
});
```

(Submissions are created as `DRAFT` by the factory and flipped to `SUBMITTED` here because
`loadJamResults` only reads submitted entries. `ratings` counts the five distinct
rater–submission pairs, including the hidden entry's.)

- [x] **Step 2: Run to verify failure**

Run: `pnpm test src/domain/results.test.ts` → FAIL (`podium` is not exported).
Run: `pnpm test:integration tests/integration/home-queries.integration.test.ts` → FAIL
(cannot resolve `@/lib/home-queries`). Requires the local test Postgres from
[installation.md](../../installation.md).

- [x] **Step 3: Implement `podium`**

Add `import type { JamResults, SubmissionResult } from "@/domain/scoring";` to the imports of
`src/domain/results.ts` and append:

```ts
// Unrated entries get the prior mean and a random tiebreak, so they must not be shown as
// winners.
export function podium(results: JamResults, size = 3): SubmissionResult[] {
  if (!results.hasOverall) return [];
  return results.competing
    .filter((r) => r.rank !== null && r.totalRatings > 0)
    .sort((a, b) => (a.rank as number) - (b.rank as number))
    .slice(0, size);
}
```

- [x] **Step 4: Implement `loadHomeData`**

Before writing, confirm the field names against the schema:
`grep -n "model Submission" -A 25 prisma/schema.prisma` (expects `title`, `status`, `visible`,
`deletedAt`) and `grep -n "model Jam " -A 40 prisma/schema.prisma` (expects `participants`,
`submissions`, `hideResults`, `resultsRevealedAt`, `visibility`).

```ts
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { jamPhase, type JamPhase } from "@/domain/jam-phase";
import { podium, resultsArePublic } from "@/domain/results";
import { loadJamResults } from "@/lib/scoring";
import { nextDeadline } from "@/lib/jam-status-display";

// HomeJam, PodiumEntry, FinishedJam, HomeData: exactly as in this task's Interfaces block.

const LIVE_SUBMISSIONS = { status: "SUBMITTED", visible: true, deletedAt: null } as const;
const LISTED: Prisma.JamWhereInput = {
  deletedAt: null,
  visibility: "PUBLIC",
  publishedAt: { not: null },
};
const SELECT = {
  id: true, slug: true, name: true, shortDesc: true, ranked: true, publishedAt: true,
  startDate: true, endDate: true, ratingEnd: true, hideResults: true, resultsRevealedAt: true,
  _count: { select: { participants: true, submissions: { where: LIVE_SUBMISSIONS } } },
} satisfies Prisma.JamSelect;

function findRows(
  where: Prisma.JamWhereInput,
  orderBy: Prisma.JamOrderByWithRelationInput,
  take: number
) {
  return db.jam.findMany({ where: { AND: [LISTED, where] }, select: SELECT, orderBy, take });
}
type Row = Awaited<ReturnType<typeof findRows>>[number];

function toHomeJam(row: Row, now: Date): HomeJam {
  return {
    id: row.id, slug: row.slug, name: row.name, shortDesc: row.shortDesc, ranked: row.ranked,
    publishedAt: row.publishedAt, startDate: row.startDate, endDate: row.endDate,
    ratingEnd: row.ratingEnd, phase: jamPhase(row, now),
    joined: row._count.participants, entries: row._count.submissions,
  };
}

async function loadPodium(
  row: Row,
  phase: JamPhase
): Promise<{ podium: PodiumEntry[] | null; ratings: number }> {
  if (!resultsArePublic({ ...row, phase })) return { podium: null, ratings: 0 };
  const [results, raterPairs] = await Promise.all([
    loadJamResults(row.id),
    db.rating.groupBy({
      by: ["submissionId", "userId"],
      // Relation filters bypass the soft-delete extension, so exclude deleted entries here.
      where: { submission: { jamId: row.id, status: "SUBMITTED", deletedAt: null } },
    }),
  ]);
  // Rank over everything, then drop moderated (hidden) entries from the homepage.
  const ranked = podium(results, results.competing.length);
  const visible = await db.submission.findMany({
    where: { id: { in: ranked.map((r) => r.submissionId) }, visible: true },
    select: { id: true, title: true },
  });
  const titleOf = new Map(visible.map((s) => [s.id, s.title]));
  return {
    ratings: raterPairs.length,
    podium: ranked
      .filter((r) => titleOf.has(r.submissionId))
      .slice(0, 3)
      // Renumber: a hidden entry may hold rank 1, and the homepage must still start at 1st.
      .map((r, i) => ({
        place: i + 1,
        submissionId: r.submissionId,
        title: titleOf.get(r.submissionId) as string,
        score: r.finalScore,
      })),
  };
}

export async function loadHomeData(now = new Date()): Promise<HomeData> {
  const [ongoing, rating, upcoming, finished] = await Promise.all([
    findRows({ startDate: { lte: now }, endDate: { gt: now } }, { endDate: "asc" }, 6),
    findRows(
      { ranked: true, endDate: { lte: now }, ratingEnd: { gt: now } },
      { ratingEnd: "asc" },
      6
    ),
    findRows({ startDate: { gt: now } }, { startDate: "asc" }, 6),
    findRows(
      { OR: [{ ranked: true, ratingEnd: { lte: now } }, { ranked: false, endDate: { lte: now } }] },
      { endDate: "desc" },
      3
    ),
  ]);

  // Each group is already sorted by its own deadline; merge them on the next deadline.
  const deadline = (j: HomeJam) => nextDeadline(j, j.phase)?.at.getTime() ?? Infinity;
  const live = [...ongoing, ...rating]
    .map((r) => toHomeJam(r, now))
    .sort((a, b) => deadline(a) - deadline(b))
    .slice(0, 6);

  return {
    live,
    upcoming: upcoming.map((r) => toHomeJam(r, now)),
    finished: await Promise.all(
      finished.map(async (r) => {
        const jam = toHomeJam(r, now);
        return { ...jam, ...(await loadPodium(r, jam.phase)) };
      })
    ),
  };
}
```

If `@/generated/prisma/client` does not export `Prisma`, import it from wherever
`src/lib/db.ts` gets the client (`grep -n "import" src/lib/db.ts`).

- [x] **Step 5: Rebuild the homepage**

`src/app/page.tsx` keeps `export const dynamic = "force-dynamic"`, a Suspense boundary and a
skeleton:

```tsx
import { Suspense } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { JamProgress } from "@/components/jam/jam-progress";
import { Countdown } from "@/components/jam/countdown";
import {
  TONE_TEXT,
  formatDuration,
  formatTimeLeftShort,
  jamStatus,
  nextDeadline,
  phaseProgress,
} from "@/lib/jam-status-display";
import { loadHomeData, type FinishedJam, type HomeJam } from "@/lib/home-queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY = new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", timeZone: "UTC" });

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 md:px-12">
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
      <RunningAJam />
    </div>
  );
}

async function HomeContent() {
  const now = new Date();
  const { live, upcoming, finished } = await loadHomeData(now);
  return (
    <>
      <section className="grid gap-10 py-12 md:grid-cols-12 md:gap-8 md:py-24">
        <div className="flex flex-col gap-6 md:col-span-6 md:pt-6">
          <a
            href="https://github.com/Pierre-Demessence/GameJams-Organizer-2"
            className="inline-flex min-h-8 items-center gap-2 self-start rounded-full border px-3 text-xs text-muted-foreground"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-brand" />
            Free and open source
          </a>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl md:leading-[1.02]">
            Game jams,<br className="hidden md:block" /> run properly.
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
            Create, join and rate game jams. Your games stay on itch.io — we handle the schedule,
            the teams and fair rankings.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link href="/jams" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}>
              Browse jams
            </Link>
            <Link href="/jams/new" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5")}>
              Host a jam
            </Link>
          </div>
        </div>
        <LivePanel jams={live} now={now} className="md:col-span-5 md:col-start-8" />
      </section>
      {upcoming.length > 0 && <UpcomingSection jams={upcoming} now={now} />}
      {finished.length > 0 && <ResultsSection jams={finished} />}
    </>
  );
}
```

Implement the remaining components in the same file:

- `LivePanel({ jams, now, className }: { jams: HomeJam[]; now: Date; className?: string })` —
  card (`rounded-xl border bg-card`) with a 48px header row ("Live now" with a `bg-live` dot,
  and a "View all" link to `/jams`). One `<li>` per jam: 36px initials tile
  (`name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()`), name linked to
  `/jams/{slug}`, `"{joined} joined · {entries} entries"` in `text-subtle-foreground`; on the
  right, `<Countdown to={deadline.at.toISOString()} />` above `deadline.label` in
  `TONE_TEXT[jamStatus(phase).tone]`; below, `<JamProgress phase value={phaseProgress(jam, phase, now)} />`.
  **Empty state** (`jams.length === 0`): the paragraph "Nothing is live right now." and a link
  "See what's coming up" to `/jams`.
- `UpcomingSection({ jams, now })` — `<h2>Upcoming</h2>` with a "Full schedule →" link. From
  `md` up, a `<table>` with columns Starts (mono, `DAY.format(startDate)`), Jam (name link +
  short description), Format (`Ranked` / `Showcase`), Duration
  (`formatDuration(startDate, endDate)`), Joined (mono, right), Starts in (mono, right,
  `formatTimeLeftShort(startDate - now)`). Below `md`, the same data as a `<ul>` of rows:
  date, name, `"{Format} · {duration} · {joined} joined"`. Caption the Starts column
  "Starts (UTC)".
- `ResultsSection({ jams }: { jams: FinishedJam[] })` — `<h2>Recent results</h2>` with a
  "Past jams →" link. Grid `md:grid-cols-3`, one card per jam: name linked to
  `/jams/{slug}/results` (ranked) or `/jams/{slug}` (showcase), end date (mono, UTC), meta line
  `"{entries} entries · {ratings} ratings"` (ranked) or `"Showcase · {entries} games"`.
  Body, by case:
  - `podium` has entries → rows of place (mono; 1st in `text-rating`), title linked to
    `/submissions/{submissionId}`, `score?.toFixed(2)` (mono).
  - ranked and `podium === null` → "Results not revealed yet".
  - ranked and `podium.length === 0` → "No ratings yet".
  - showcase → "Browse the showcase" linked to `/jams/{slug}`.
- `RunningAJam()` (static, outside Suspense) — bordered block (`rounded-xl border p-6 md:p-8`,
  `mb-20`), `<h2>Running a jam?</h2>`, "Set it up in private, publish when it's ready — the
  dates take it from there.", outline button "Host a jam →" to `/jams/new`, then an `<ol>` of
  five steps (`md:grid-cols-5`; stacked on mobile with a 3px left bar instead of a top bar).
  Bar and label colors: Draft `bg-input` / `text-muted-foreground`, Upcoming brand, Live live,
  Rating rating, Results finished. Copy:
  - Draft — "Write the brief, set dates, criteria and questions. Only organizers can see it."
  - Upcoming — "Published. People join and find teammates while the theme stays secret."
  - Live — "The theme drops. Teams build and link their itch.io pages."
  - Rating — "Participants play and score entries 1–5 on your criteria."
  - Results — "Rankings are computed. Reveal them straight away, or when you choose."
  - Footnote: "Showcase jams skip rating — the games are the result."
- `HomeSkeleton()` — a hero-height block plus three `h-40 animate-pulse rounded-xl bg-muted`
  tiles.

Spacing: `pb-20` between sections; section headings `text-xl font-semibold tracking-tight`.

- [x] **Step 6: Run the tests to verify they pass**

Run: `pnpm test && pnpm test:integration tests/integration/home-queries.integration.test.ts`
Expected: PASS.

- [x] **Step 7: Verify visually**

Run `pnpm db:seed && pnpm dev`. Compare `/` at 1440px and 390px with the **Home — desktop**
and **Home — mobile** boards, in both themes. Check that the live panel counts down every
second, that there is no horizontal scroll at 390px, and that with every jam unpublished
(Prisma Studio: `pnpm db:studio`) the live panel shows the empty state.

- [x] **Step 8: Commit**

```bash
git add src/domain/results.ts src/domain/results.test.ts src/lib/home-queries.ts tests/integration/home-queries.integration.test.ts src/app/page.tsx vitest.config.mts
git commit -m "feat(home): rebuild homepage with live panel, schedule and results"
```

---

### Task 7: E2E checks, docs, review and wrap-up

**Files:**

- Modify: `tests/e2e/smoke.spec.ts`
- Create: `docs/design-system.md`
- Modify: `docs/INDEX.md`, `docs/codebase.md`, `docs/features.md`, `docs/agent/README.md`,
  `docs/backlog.md`, `CHANGELOG.md`
- Move: `docs/plans/redesign-foundations.md` → `docs/plans/done/`

- [x] **Step 1: Add the e2e checks**

Append inside the `smoke` describe:

```ts
test("the page is dark when no theme is stored", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(11, 12, 14)");
});

test("a stored light theme is applied", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(250, 250, 250)");
});

test("homepage shows the hero and the live panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Game jams/ })).toBeVisible();
  await expect(page.getByText("Live now")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ongoing Jam" }).first()).toBeVisible();
});
```

Run: `pnpm test:e2e` → Expected: all smoke tests pass, the existing ones included.

- [x] **Step 2: Write `docs/design-system.md`**

Present tense, no frontmatter, no dates. Sections: Principles (calm, dark-first, one accent;
status colors carry meaning); Tokens (the two color tables from Global Constraints with the
Tailwind utility for each, plus `--radius: 0.5rem`); Typography (Geist / Geist Mono and when to
use mono); Jam status (label and tone table, `TONE_*` maps, `JamStatusBadge`, `JamProgress`,
`Countdown`); App shell (`SiteHeader`, `UserMenu`, `Footer`); Design source (the canvas link,
private to the owner).

- [x] **Step 3: Update the other docs**

- `docs/INDEX.md` — add "[Design System](design-system.md) — tokens, typography and shared UI
  components" under Project.
- `docs/codebase.md` — add `src/components/jam/` (jam status UI), `src/lib/jam-status-display.ts`
  and `src/lib/home-queries.ts` to the directory map; replace `navbar.tsx` with
  `site-header.tsx`.
- `docs/features.md` — add "**Visual design & themes** | Dark-first design with a light theme;
  account menu with profile, settings, theme and sign out | Medium" to the MVP table.
- `docs/agent/README.md` — invariants: "Colors come from the tokens in `globals.css`; never
  hard-code hex values in components." and "`session.user.username` may be `null`; hide
  profile links when it is." Paths: `src/lib/jam-status-display.ts` (pure, unit-tested),
  `src/lib/home-queries.ts` (database reads, integration-tested, excluded from unit coverage).
- `docs/backlog.md` — repoint the Redesign link to `plans/done/redesign-foundations.md`, and
  add to Known issues: "The settings page does not call `update()` after a username change, so
  the account menu shows the old username until the next sign-in."
- `CHANGELOG.md` — under Unreleased → Changed: "New dark-first visual design: tokens, site
  header with account menu, footer and homepage." Under Added: "`username` on the session."

- [x] **Step 4: Full verification**

Run: `pnpm lint && pnpm build && pnpm test && pnpm test:integration && pnpm test:e2e`
Expected: all green. Every checkbox in this plan should already be ticked as each step was
completed; confirm none are left.

- [x] **Step 5: Peer review loop**

Run a review subagent on a small model with this instruction: "You are a subAgent. Do not use
`vscode_askQuestions`. Do NOT edit code. Review the diff from the commit before Task 1 to HEAD
for correctness, edge cases, types/tests, architecture and docs gaps against
`docs/plans/redesign-foundations.md`; return a structured list or LGTM." Fix every finding,
commit the fixes, and re-run until it returns LGTM.

- [x] **Step 6: Move the plan and fix its links, in the final commit**

Move the plan, then repoint its relative links, which gain one level
(`../backlog.md` → `../../backlog.md`, `../specs/product-spec.md` →
`../../specs/product-spec.md`, `../installation.md` → `../../installation.md`):

```bash
git mv docs/plans/redesign-foundations.md docs/plans/done/redesign-foundations.md
sed -i 's#](\.\./#](../../../#g' docs/plans/done/redesign-foundations.md
git add docs/plans/done/redesign-foundations.md tests/e2e/smoke.spec.ts docs CHANGELOG.md
git commit -m "docs: design system reference and redesign foundations wrap-up"
```
