# Agent Operational Guide

## Purpose

AI agent reference for the GameJam Organizer 2 codebase. Read this on-demand before making changes.

## Scripts

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Start dev server (port 3000) |
| `pnpm build` | Production build (standalone output) |
| `pnpm lint` | ESLint check |
| `pnpm format` | Prettier format |
| `pnpm test` | Vitest unit tests |
| `pnpm test:coverage` | Vitest unit tests with V8 coverage (scoped to unit-owned logic) |
| `pnpm test:coverage:all` | Merged whole-app coverage (unit + integration; needs Postgres) |
| `pnpm test:integration` | Server-action integration tests against a Postgres test DB (`gamejams_test`) |
| `pnpm test:coverage:integration` | Integration tests with coverage (CI uploads this as the `integration` flag) |
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm db:migrate` | Create and apply migrations (`prisma migrate dev`) |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:seed` | Seed sample users, jams, submissions and ratings (re-running re-anchors jam dates to now) |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `docker compose up -d --build` | Build and start production stack |
| `docker compose run --rm migrate` | Run DB migration in Docker |

## Important Paths

| Path | Description |
| ---- | ----------- |
| `prisma/schema.prisma` | Database schema (single source of truth) |
| `src/lib/auth.ts` | Auth.js exports (`auth`, `signIn`, `signOut`) |
| `src/lib/auth.config.ts` | Auth providers and callbacks |
| `src/domain/` | Pure spec rules (phase, participation, submission, rating, results, scoring) |
| `src/lib/db.ts` | Prisma client singleton + soft-delete read filter |
| `src/lib/validations.ts` | All Zod schemas |
| `src/lib/permissions.ts` | Permission catalog + stackable-role checks |
| `src/lib/jam-status-display.ts` | Jam status labels, tones and countdown formatting (pure, unit-tested) |
| `src/lib/home-queries.ts` | Homepage database reads (integration-tested, excluded from unit coverage) |
| `src/lib/jam-phase-where.ts` | `LISTED_JAM` and `jamPhaseWhere()`: SQL phase filters |
| `src/lib/jam-list-params.ts`, `jam-page.ts`, `jam-entries.ts`, `jam-labels.ts`, `initials.ts`, `results-view.ts`, `profile.ts`, `jam-form.ts`, `submission-form.ts`, `manage.ts`, `admin.ts`, `search.ts` | Pure page helpers (unit-tested) |
| `src/lib/jam-list-queries.ts`, `jam-page-queries.ts`, `jam-entries-queries.ts`, `results-queries.ts`, `profile-queries.ts`, `manage-queries.ts`, `search-queries.ts` | Page loaders (integration-tested, excluded from unit coverage) |
| `src/app/search-actions.ts`, `src/components/search-palette.tsx` | ⌘K search palette and its public action |
| `src/lib/verification.ts` | itch.io ownership verification (allowlisted fetch) |
| `src/app/` | All pages and server actions |
| `src/components/ui/` | shadcn/ui components |
| `docs/specs/` | Requirements, design, tasks |

## Invariants

- **Phase filters in SQL** go through `jamPhaseWhere()` / `LISTED_JAM`; never hand-write date conditions.
- **URL params** (search, filters, paging) are parsed and clamped by `parseJamListParams` / `parseEntriesParams` before reaching a query.
- **Colors** come from the tokens in `globals.css`; never hard-code hex values in components.
- **`session.user.username`** may be `null`; hide profile links when it is.
- **Prisma client** is imported from `@/generated/prisma/client`, wrapped by `@/lib/db`.
- **Schema changes** go through SQL migrations (`pnpm db:migrate`), not `db push`.
- **Access control** is permission-based: gate mutations with `checkJamPermission(jamId, userId, permission)`. Jam roles are **stackable** — effective powers are the union of a user's roles (`getJamRoles` + `hasPermission`). Never inline `role === "ADMIN"`.
- **Rules live in `src/domain/`**: pure functions returning a `Decision`. Actions and pages load data, call the rule, and surface `reason`; they never re-implement a phase or permission rule inline.
- **Jam phase** comes from `jamPhase()`; there is no stored status. A jam is DRAFT until `publishedAt` is set (via `canPublish`). Listings require `publishedAt != null` and `visibility = PUBLIC`.
- **Soft delete**: top-level `Jam`/`Submission` reads are filtered by the `db` extension. Relation filters, `include`s and `_count` are not — add `deletedAt: null` there. Name `deletedAt` in the `where` to read deleted rows (staff trash view).
- **Results** are computed on read (`loadJamResults`); visibility goes through `resultsAccess`. There is no results table. Hidden submissions (`visible: false`) are ranked but dropped from every displayed result.
- **Redirects after sign-in** go through `safeCallbackPath`; never push a raw `callbackUrl`.
- **Profiles** list only `LISTED_JAM` jams, so unlisted and draft jams never leak through a member's page.
- **A rating** covers every RATED criterion exactly once (`checkRatingScores`); partial ratings are rejected.
- **`"use server"` files export only actions**: every export is a public endpoint, so read helpers go in `src/lib/` modules.
- **Editors inside the jam form** (criteria, custom questions) use no `<form>` and no `name` attributes: they save through their own actions, and Enter must not submit the jam form.
- **HTML `pattern` attributes** compile with the `v` flag: escape `-` inside character classes.
- **Restoring a jam** strips the `__del__<id>` slug suffix (`restoredSlug`) and fails if the slug was reused.
- **Moderation** is three independent switches on `Submission` (`visible` / `rateable` / `competing`) + `moderationReason`, applied via presets (disqualify / exclude / hide / reinstate).
- **Deleting a submission**: organizers (`delete_submission`), staff, or the team leader while ONGOING (`canDeleteOwnSubmission`). Staff deletes and restores are audited.
- **Submission lifecycle**: DRAFT → SUBMITTED; a submission may only become SUBMITTED once its itch.io link is ownership-verified. Changing the verified link resets it to DRAFT.
- **itch.io fetch** uses a single-host allowlist (`itch.io` / `*.itch.io`), HTTPS only, with per-hop redirect re-validation, a timeout, and a size cap.
- **Auth.js v5 beta.30** uses JWT strategy. No session table.
- **shadcn/ui** uses `@base-ui/react` (NOT Radix). No `asChild` — use `render` prop.
- **Zod v4**: Use `.issues` not `.errors` on `ZodError`.
- **Server Actions**: Colocated in `actions.ts` next to pages.
- **All user input** validated with Zod schemas before database operations.
- **Client IP** comes from `clientIp()` (last `X-Forwarded-For` hop, appended by the single Traefik proxy); never read the first entry, which the client controls.
- **Search** (`searchJamsAction`) is public, limited to `LISTED_JAM`, and throttled per IP.
- **Rate limiting** via `checkRateLimit()` in `src/lib/rate-limit.ts` on all mutating actions.
- **Tests**: unit tests colocated as `*.test.ts` (Vitest); E2E in `tests/e2e/*.spec.ts` (Playwright).
- **`export const dynamic = "force-dynamic"`** is required on any page that queries the DB without `auth()`/`cookies()` (currently: homepage).
- Build must produce **0 errors** before any task is marked done.
- `node_modules/`, `.next/`, `src/generated/` are gitignored.

## Tech Constraints

- Next.js 16.3.4, TypeScript strict mode
- Node.js 24.20.0 (pinned via Volta), pnpm 9.12.3 (pinned via `packageManager`)
- PostgreSQL 16 via Docker
- Tailwind CSS v4 (not v3 — different config format)
- No `any` without inline justification
