# Design System

## Principles

- **Calm.** Quiet surfaces, thin borders and generous spacing; content leads, chrome recedes.
- **Dark-first.** Dark is the default theme. Users pick System, Dark or Light from the account menu (signed in) or from the header toggle and mobile menu sheet (signed out); the choice is stored in `localStorage` under `theme`.
- **One accent.** The brand color is the only accent. It marks links, focus rings and the "Upcoming" status.
- **Status colors carry meaning.** Green is live, amber is rating, grey is finished, red is danger. They are never used for decoration.
- **No emoji in UI chrome.**
- **Accessible.** Touch targets are at least 44px on mobile and text contrast is at least 4.5:1.

## Tokens

Tokens are CSS variables in `src/app/globals.css`, exposed to Tailwind through `@theme inline`. Components use the utilities below and never hard-code hex values.

### Colors

| Token | Dark | Light | Tailwind utility |
|-------|------|-------|------------------|
| background | `#0B0C0E` | `#FAFAFA` | `bg-background` |
| surface / card | `#121316` | `#FFFFFF` | `bg-card` |
| raised | `#1A1B1F` | `#F4F4F5` | `bg-secondary`, `bg-muted` |
| hover / focus | `#222328` | `#EBEBED` | `bg-accent` (menu items; one step past raised so it shows on muted surfaces) |
| brand on dark fills | — | — | `--color-discord` `#5865F2` (Discord button), `--color-preview-dark` / `-light` (theme previews) |
| border | `#24262B` | `#E4E4E7` | `border-border` |
| border strong / input | `#34373E` | `#D4D4D8` | `border-input` |
| text | `#EDEEF0` | `#0B0C0E` | `text-foreground` |
| muted | `#9A9CA3` | `#52555C` | `text-muted-foreground` |
| subtle | `#80838B` | `#686B73` | `text-subtle-foreground` |
| brand (accent) | `#8B97FF` | `#4A5AE8` | `text-brand`, `bg-brand`, `ring-ring` |
| live | `#3FB97A` | `#1C7F4B` | `text-live`, `bg-live` |
| rating | `#E0A63B` | `#95600A` | `text-rating`, `bg-rating` |
| finished | `#8A8D95` | `#5E616A` | `text-finished`, `bg-finished` |
| danger | `#F2706A` | `#C23A33` | `text-destructive`, `bg-destructive` |
| track | `#1F2126` | `#EBEBED` | `bg-track` |
| primary button | `#EDEEF0` on `#0B0C0E` | `#0B0C0E` on `#FFFFFF` | `bg-primary text-primary-foreground` |

### Radius

`--radius` is `0.5rem`. The `rounded-sm` to `rounded-4xl` utilities scale from it.

## Typography

- **Geist** (`font-sans`) is the font for all text.
- **Geist Mono** (`font-mono`) is for dates, countdowns, scores and counts, where aligned digits matter.

Both fonts are loaded in `src/app/layout.tsx`.

## Jam status

`src/lib/jam-status-display.ts` is the pure, unit-tested source for how a phase looks. `jamStatus(phase)` returns the label and tone.

| Phase | Label | Tone | Color |
|-------|-------|------|-------|
| `DRAFT` | Draft | `draft` | muted, dashed outline |
| `UPCOMING` | Upcoming | `upcoming` | brand |
| `ONGOING` | Live | `live` | live |
| `RATING` | Rating | `rating` | rating |
| `FINISHED` | Finished | `finished` | finished |

The `TONE_TEXT`, `TONE_BG` and `TONE_PILL` maps give the text, fill and pill-background classes for each tone. The same module holds `nextDeadline`, `phaseProgress`, `formatCountdown`, `formatTimeLeftShort` and `formatDuration`.

Shared components live in `src/components/jam/`:

- `JamStatusBadge` renders the status pill for a phase.
- `JamProgress` renders a thin progress bar on the `track` color, filled with the phase tone.
- `Countdown` renders a live countdown to an ISO date string in Geist Mono.
- `JamCard` is the jam list card: cover, status pill, stretched title link, progress, UTC dates.
- `JamTimeline` is the labelled Upcoming / Jam / Rating bar with the next-deadline countdown.

## Shared primitives

- `CoverImage` (`src/components/cover-image.tsx`) renders an external image or, without a URL, the dotted placeholder with `initials(name)`.
- `LinkTabs` (`src/components/link-tabs.tsx`) is a tab bar of real links with `aria-current="page"`; it scrolls horizontally on mobile.
- The `no-scrollbar` utility in `globals.css` hides a scroll container's scrollbar.

## Images

Images are external URLs, never hosted assets. Render them with `<img loading="lazy" referrerPolicy="no-referrer">`, always with `alt` (empty when the title follows), and fall back to the dotted placeholder when the URL is missing.

## App shell

- `SiteHeader` (`src/components/site-header.tsx`) is the sticky top bar with the `Logo`, primary navigation, a search link to `/jams`, and the account area.
- `UserMenu` (`src/components/user-menu.tsx`) is the signed-in dropdown: profile (hidden when `session.user.username` is `null`), settings, the theme picker (`theme-menu-items.tsx`) and sign out.
- `Footer` (`src/components/footer.tsx`) is the site-wide footer.

All three are mounted in `src/app/layout.tsx`.

## Design source

The approved design is the "GameJam Organizer — Website Design" canvas: <https://claude.ai/artifact/SPJeNxb9rsAiNeGNoeBXqB>. It is private to the owner.
