# AGENTS.md

GameJam Organizer: a Next.js app to host, join and rate game jams. Pre-v1 prototype.

## Docs

| File | Holds |
| --- | --- |
| `docs/specs/product-spec.md` | Full product spec, the source of truth for rules (cite its § numbers) |
| `docs/specs/requirements.md` | MVP requirements in EARS form |
| `docs/architecture.md` | Layers, auth flow, jam lifecycle, scoring, results visibility, security |
| `docs/design-system.md` | Tokens, typography, shared UI primitives, link to the design canvas |
| `docs/configuration.md` | Environment variables |
| `docs/deployment.md` | Kubernetes / ArgoCD deploy, Docker Compose, admin bootstrap |
| `docs/decisions.md` | Non-obvious decisions and rejected alternatives |
| `docs/backlog.md` | Everything not done: MVP gaps, known issues, spec proposals, post-MVP |
| `docs/roadmap.md` | Milestone order and what defines each as done |
| `docs/plans/` | Plans for work in progress only |

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev server on port 3000 |
| `pnpm build` | Production build (standalone output) |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm test` | Vitest unit tests |
| `pnpm test:coverage` | Unit tests with V8 coverage (scoped to unit-owned logic) |
| `pnpm test:integration` | Server-action integration tests against Postgres (`gamejams_test` DB) |
| `pnpm test:coverage:integration` | Integration tests with coverage (CI uploads it as the `integration` flag) |
| `pnpm test:coverage:all` | Merged unit + integration coverage (needs Postgres) |
| `pnpm test:e2e` | Playwright E2E (needs the app and a seeded database) |
| `pnpm db:migrate` | Create and apply migrations (`prisma migrate dev`), regenerate the client |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:seed` | Seed sample data (re-running re-anchors jam dates to now) |
| `docker compose up db -d` | Start the local Postgres |

The build must produce 0 errors before a task is done.

## Layout

| Path | Holds |
| --- | --- |
| `src/app/` | Pages, layouts and colocated `actions.ts` (Server Actions) |
| `src/domain/` | Pure spec rules returning a `Decision`; no Prisma, `auth()` or Next imports |
| `src/lib/*-queries.ts` | Page loaders (server-only, integration-tested, excluded from unit coverage) |
| `src/lib/*.ts` | Pure page helpers (unit-tested) and I/O helpers (`db`, `auth`, `permissions`, `verification`, `rate-limit`) |
| `src/lib/validations.ts` | All Zod schemas |
| `src/components/ui/` | shadcn/ui primitives (`npx shadcn@latest add`) |
| `src/components/jam/` | Jam status UI (badge, progress, countdown, card, timeline) |
| `src/types/` | TypeScript module augmentations (Auth.js session types) |
| `src/generated/prisma/` | Generated Prisma client (gitignored) |
| `prisma/` | `schema.prisma` (source of truth), SQL migrations, `seed.ts` |
| `tests/integration/` | Server-action tests against a real Postgres |
| `tests/e2e/` | Playwright specs |
| `k8s/<env>/` | Kubernetes manifests synced by ArgoCD |

## Conventions

- Files kebab-case, components PascalCase, functions and variables camelCase; import through
  the `@/` alias (`src/`).
- Unit tests are colocated `*.test.ts`.
- New spec rule ("who can do what, when") → `src/domain/`; new DB read → a `*-queries.ts`
  loader; formatting / mapping logic → a pure `src/lib/` helper with tests.
- No `any` without an inline justification.

## Invariants

- **Rules live in `src/domain/`**: actions and pages load data, call the rule and surface its
  `reason`; they never re-implement a phase or permission rule inline.
- **Access control** is permission-based: gate mutations with
  `checkJamPermission(jamId, userId, permission)`. Jam roles stack (union of `getJamRoles` +
  `hasPermission`). Never inline `role === "ADMIN"`.
- **Auth**: read the session with `auth()` from `@/lib/auth` in server components and actions.
- **All user input** is validated with Zod before any database write.
- **Rate limiting**: `checkRateLimit()` (`src/lib/rate-limit.ts`) on every mutating action.
- **`"use server"` files export only actions**: every export is a public endpoint, so read
  helpers go in `src/lib/`.
- **Jam phase** comes from `jamPhase()`; there is no stored status. A jam is DRAFT until
  `publishedAt` is set (via `canPublish`). Listings require `publishedAt != null` and
  `visibility = PUBLIC`.
- **Phase filters in SQL** go through `jamPhaseWhere()` / `LISTED_JAM`; never hand-write date
  conditions.
- **URL params** (search, filters, paging) are parsed and clamped by `parseJamListParams` /
  `parseEntriesParams` before reaching a query.
- **Soft delete**: top-level `Jam` / `Submission` reads are filtered by the `db` extension.
  Relation filters, `include`s and `_count` are not: add `deletedAt: null` there. Name
  `deletedAt` in the `where` to read deleted rows (staff trash view).
- **Results** are computed on read (`loadJamResults`); visibility goes through
  `resultsAccess`. Hidden submissions (`visible: false`) are ranked but dropped from every
  displayed result.
- **A rating** covers every RATED criterion exactly once (`checkRatingScores`).
- **Moderation** is three independent switches on `Submission` (`visible` / `rateable` /
  `competing`) + `moderationReason`, applied via presets (disqualify / exclude / hide /
  reinstate).
- **Submission lifecycle**: DRAFT → SUBMITTED, only once the itch.io link is
  ownership-verified. Changing the verified link resets it to DRAFT.
- **Deleting a submission**: organizers (`delete_submission`), staff, or the team leader while
  ONGOING (`canDeleteOwnSubmission`). Staff deletes and restores are audited.
- **Restoring a jam** strips the `__del__<id>` slug suffix (`restoredSlug`) and fails if the
  slug was reused.
- **Profiles** list only `LISTED_JAM` jams, so unlisted and draft jams never leak.
- **Search** (`searchJamsAction`) is public, limited to `LISTED_JAM`, and throttled per IP.
- **itch.io fetch** uses a single-host allowlist (`itch.io` / `*.itch.io`), HTTPS only, with
  per-hop redirect re-validation, a timeout and a size cap.
- **Client IP** comes from `clientIp()` (last `X-Forwarded-For` hop, appended by the single
  Traefik proxy); never read the first entry, which the client controls.
- **Redirects after sign-in** go through `safeCallbackPath`; never push a raw `callbackUrl`.
- **`session.user.username`** may be `null`; hide profile links when it is.
- **Colors** come from the tokens in `src/app/globals.css`; never hard-code hex values.
- **Editors inside the jam form** (criteria, custom questions) use no `<form>` and no `name`
  attributes: they save through their own actions, and Enter must not submit the jam form.
- **HTML `pattern` attributes** compile with the `v` flag: escape `-` inside character classes.
- **`export const dynamic = "force-dynamic"`** is required on any page that queries the DB
  without `auth()` / `cookies()` (currently the homepage).
- **Schema changes** go through SQL migrations (`pnpm db:migrate`), never `db push`.
- **Prisma client** is imported from `@/generated/prisma/client`, used through `@/lib/db`.

## Stack facts not visible in config

- Auth.js v5 **beta** with the JWT strategy: no session table; `isStaff` and `username` live in
  the token.
- shadcn/ui is built on `@base-ui/react`, **not Radix**: no `asChild`, use the `render` prop.
- Zod v4: read `.issues`, not `.errors`, on a `ZodError`.
- Tailwind CSS v4: tokens are CSS variables in `globals.css`; there is no `tailwind.config`.
- Prisma 7 uses the `pg` driver adapter and generates the client into `src/generated/`.
- Auth redirects and route protection run in `src/middleware.ts` (edge).
