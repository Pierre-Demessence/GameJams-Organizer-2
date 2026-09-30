# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Domain layer (`src/domain/`): pure, unit-tested rules for jam phase, publishing, participation,
  submissions, rating eligibility, results visibility, and scoring
- Results reveal action for jams with "hide results"; organizer preview during rating
- Soft-delete read filter for jams and submissions as a Prisma client extension
- Integration test walking a ranked jam from draft to revealed results
- Ownership verification: itch.io code-on-page flow (single-host allowlist fetch with
  per-hop redirect re-validation, timeout, and size cap) plus a manual admin fallback
- Submission lifecycle: DRAFT / SUBMITTED states with a submit/withdraw owner panel
- Criterion `source` (RATED/JURY) and primary-criterion selection for overall ranking
- Vitest unit tests, Playwright E2E smoke tests, and a GitHub Actions CI workflow
- `username` on the session

### Changed

- New dark-first visual design: tokens, site header with account menu, footer and homepage
- Redesigned jam list, jam page and submission page; new Submissions tab on jams
- **BREAKING**: `Jam.status` replaced by `publishedAt`; publishing no longer changes visibility,
  and draft jams no longer go live when their dates arrive
- **BREAKING**: Results are computed on read; the `JamResult` table and the "Recompute Results"
  button are removed
- Results are no longer public during rating, and "hide results" keeps them hidden after the
  jam finishes until an organizer reveals them; weight-0 criteria are shown in results
- Judges can rate under every eligibility setting; members of draft or deleted submissions are
  no longer eligible raters
- Any team member can add or remove contributors (leadership transfer stays with the leader);
  contributors can be added during rating when the jam allows it
- Publishing a ranked jam requires at least one criterion and a usable overall ranking
- New jams default to public visibility and reveal-theme-on-start
- Seed re-anchors jam dates to the current time on every run

- **BREAKING**: Jam roles are now stackable (`@@unique([jamId, userId, role])`); access
  is permission-based via `getJamRoles` / `checkJamPermission`
- **BREAKING**: Submissions use a single itch.io project URL + `supportedPlatforms` instead
  of per-platform download links
- **BREAKING**: Moderation replaced `disqualified`/`hidden` booleans with three independent
  switches (`visible` / `rateable` / `competing`) and a moderation reason
- Scoring ranks only competing, submitted entries; overall = primary criterion's score when
  set, else weighted average of RATED criteria
- `revealThemeOnStart` now defaults to `true`
- Database now managed with SQL migrations (`prisma migrate`) instead of `db push`

### Fixed

- Status filters on the jam list now run in the database, so filtered lists are complete
- Submission edits no longer save partially when custom-field validation fails; optional
  custom fields can be cleared
- Members of a deleted submission can join another team
- Draft submissions no longer appear on user profiles
- A user's own ratings are no longer readable through an exposed server action
- The jam edit page honours stacked roles

## [0.1.0] - 2026-03-09

### Added

- User authentication: Discord OAuth and email/password sign-up/sign-in
- User profiles with username, bio, avatar, and jam history
- Account settings: edit profile, link/unlink OAuth providers
- Jam creation with name, slug, description, dates, themes, and rating criteria
- Jam lifecycle management: DRAFT → UPCOMING → ONGOING → RATING → FINISHED
- Jam browsing page with status filter and search
- Jam roles: Admin, Moderator, Judge, Host with granular permissions
- Join/leave jams during UPCOMING and ONGOING phases
- Game submissions with title, description, links, and contributors
- Rating system with custom criteria and Bayesian average scoring
- Results page with ranked submissions and per-criterion scores
- Jam management: edit details, manage members, moderate submissions
- In-memory rate limiting on server actions
- Responsive mobile-friendly UI with shadcn/ui and Tailwind CSS v4
- Docker production deployment (multi-stage build, PostgreSQL 16)
- Prisma schema migration service in docker-compose
