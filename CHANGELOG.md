# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Ownership verification: itch.io code-on-page flow (single-host allowlist fetch with
  per-hop redirect re-validation, timeout, and size cap) plus a manual admin fallback
- Submission lifecycle: DRAFT / SUBMITTED states with a submit/withdraw owner panel
- Criterion `source` (RATED/JURY) and primary-criterion selection for overall ranking
- Vitest unit tests, Playwright E2E smoke tests, and a GitHub Actions CI workflow

### Changed

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
