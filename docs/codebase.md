# Codebase Map

## Top-Level Structure

```
├── docs/               Documentation
│   ├── agent/          Agent operational docs
│   └── specs/          Requirements, design, tasks, draft
├── tests/              Standalone test suites
│   ├── e2e/            Playwright end-to-end tests (*.spec.ts)
│   └── integration/    Server-action integration tests (real Postgres)
├── prisma/
│   ├── migrations/     SQL migration history
│   ├── schema.prisma   Database schema (single source of truth)
│   └── seed.ts         Database seed script
├── public/             Static assets
├── src/
│   ├── app/            Next.js App Router pages and layouts
│   ├── components/     Shared React components
│   ├── domain/         Pure spec rules (no DB, auth or Next imports) + colocated *.test.ts
│   ├── generated/      Prisma generated client (gitignored, not committed)
│   ├── lib/            Server-side utilities and business logic (+ colocated *.test.ts)
│   ├── types/          TypeScript type extensions
│   └── middleware.ts   Next.js edge middleware (auth redirects)
├── .github/workflows/  CI (typecheck, lint, unit, e2e)
├── Dockerfile          Multi-stage production build
├── docker-compose.yml  Service orchestration
├── playwright.config.ts E2E runner config
├── vitest.config.mts   Unit-test runner config
└── prisma.config.ts    Prisma config (driver adapter)
```

## Route Structure (`src/app/`)

| Path | Description |
|------|-------------|
| `page.tsx` | Homepage — lists featured/recent jams |
| `layout.tsx` | Root layout (fonts, theme, site header, footer, Toaster) |
| `(auth)/sign-in/` | Sign-in page |
| `(auth)/sign-up/` | Sign-up page |
| `jams/page.tsx` | Browse all jams (filterable) |
| `jams/new/` | Create a new jam |
| `jams/[slug]/page.tsx` | Jam detail page |
| `jams/[slug]/edit/` | Edit jam (organizer only) |
| `jams/[slug]/manage/` | Manage jam roles (stackable) — organizer only |
| `jams/[slug]/submissions/new/` | Submit a game to this jam |
| `jams/[slug]/results/` | Jam results/rankings |
| `submissions/[id]/` | Submission detail (verify, submit, moderate) |
| `submissions/[id]/edit/` | Edit a submission |
| `submissions/[id]/rate/` | Rate a submission (rating period) |
| `users/[username]/` | Public user profile |
| `settings/` | Account settings (profile, linked accounts) |

## Domain Rules (`src/domain/`)

Pure functions over plain data plus `now`, one module per spec area. Each rule traces to a
[product-spec](specs/product-spec.md) section and is unit-tested exhaustively.

| File | Purpose |
|------|---------|
| `decision.ts` | `Decision` result type (`allowed` + user-facing `reason`) shared by all rules |
| `jam-phase.ts` | `jamPhase` (DRAFT until `publishedAt`, then from dates), `validateJamDates`, `canPublish` (§4.4, §6.2) |
| `participation.ts` | `canJoin`, `canLeaveJam`, `canLeaveSubmission` (§4.7) |
| `submission.ts` | Create / edit / finalize / unsubmit windows, contributor change window, leadership transfer (§5) |
| `rating.ts` | `isEligibleRater`, `canRate` — judges always eligible, own entry excluded (§4.6, §6.1, §6.3) |
| `results.ts` | `resultsAccess` (none / preview / public), `canRevealResults` (§6.5) |
| `scoring.ts` | `rankSubmissions`: Bayesian per-criterion scores, overall by primary or weighted average (§6.4) |

## Library Modules (`src/lib/`)

| File | Purpose |
|------|---------|
| `auth.ts` | Auth.js handlers (`signIn`, `signOut`, `auth`) |
| `auth.config.ts` | Auth.js providers and callbacks |
| `db.ts` | Prisma client singleton with the soft-delete read filter for `Jam` and `Submission` |
| `permissions.ts` | Permission catalog + `getJamRoles`, `hasPermission`, `checkJamPermission` (stackable roles) |
| `verification.ts` | itch.io ownership verification (single-host allowlist fetch + code generation) |
| `rate-limit.ts` | In-memory rate limiter for server actions |
| `scoring.ts` | `loadJamResults`: loads a jam's criteria, submissions and ratings, ranks them via `domain/scoring` |
| `rating-queries.ts` | `loadRater`, `getUserRatings` (server-only; never exported from a `"use server"` file) |
| `form-parsers.ts` | FormData → Zod parsing for jam and submission forms; custom-field value reader |
| `validations.ts` | Zod schemas for forms and server actions |
| `jam-status-display.ts` | Jam status labels, tone class maps, deadline, progress and countdown formatting (pure) |
| `home-queries.ts` | `loadHomeData`: live, upcoming and finished jams with podiums for the homepage (server-only) |
| `utils.ts` | General utilities (`cn` class merge, etc.) |

### Middleware (`src/middleware.ts`)

Edge middleware that handles auth-related redirects and route protection.

## Components (`src/components/`)

| File | Purpose |
|------|---------|
| `site-header.tsx` | Site-wide header: logo, navigation, search link, account area |
| `logo.tsx` | Site logo |
| `footer.tsx` | Site-wide footer |
| `user-menu.tsx` | Authenticated account dropdown menu |
| `theme-menu-items.tsx` | System / Dark / Light radio items for the account menu |
| `jam/` | Jam status UI: `jam-status-badge`, `jam-progress`, `countdown` |
| `ui/` | shadcn/ui primitive components |

## Conventions

- **Server Actions**: Colocated in `actions.ts` files next to the pages that use them.
- **Validation**: All user input validated with Zod schemas from `lib/validations.ts`.
- **Auth checks**: Use `auth()` from `lib/auth.ts` in server components and actions.
- **Access control**: Gate every mutation with `checkJamPermission(jamId, userId, permission)`; never inline `role === "ADMIN"`.
- **Testing**: Unit tests colocated as `*.test.ts` (Vitest); server-action integration tests in `tests/integration/` against a real Postgres test DB (`pnpm test:integration`); E2E in `tests/e2e/*.spec.ts` (Playwright).
- **Naming**: kebab-case files, PascalCase components, camelCase functions/variables.
- **Imports**: Use `@/` path alias (maps to `src/`).
- **Prisma client**: Import from `@/generated/prisma/client`, access via `@/lib/db`.

## Where to Add New Code

| What | Where |
|------|-------|
| New page/route | `src/app/<route>/page.tsx` |
| New server action | `src/app/<route>/actions.ts` |
| Shared component | `src/components/` |
| UI primitive (shadcn) | `src/components/ui/` via `npx shadcn@latest add` |
| Spec rule (who can do what, when) | `src/domain/` |
| Business logic with I/O | `src/lib/` |
| Zod schema | `src/lib/validations.ts` |
| Database model | `prisma/schema.prisma` then `pnpm db:migrate` |
| Unit test | Colocate `*.test.ts` next to the module |
| E2E test | `tests/e2e/*.spec.ts` |
| Type extension | `src/types/` |
