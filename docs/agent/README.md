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
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm db:migrate` | Create and apply migrations (`prisma migrate dev`) |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:seed` | Seed sample users, jams, submissions, ratings, and results |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `docker compose up -d --build` | Build and start production stack |
| `docker compose run --rm migrate` | Run DB migration in Docker |

## Important Paths

| Path | Description |
| ---- | ----------- |
| `prisma/schema.prisma` | Database schema (single source of truth) |
| `src/lib/auth.ts` | Auth.js exports (`auth`, `signIn`, `signOut`) |
| `src/lib/auth.config.ts` | Auth providers and callbacks |
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/validations.ts` | All Zod schemas |
| `src/lib/permissions.ts` | Permission catalog + stackable-role checks |
| `src/lib/verification.ts` | itch.io ownership verification (allowlisted fetch) |
| `src/app/` | All pages and server actions |
| `src/components/ui/` | shadcn/ui components |
| `docs/specs/` | Requirements, design, tasks |

## Invariants

- **Prisma client** is imported from `@/generated/prisma/client`, wrapped by `@/lib/db`.
- **Schema changes** go through SQL migrations (`pnpm db:migrate`), not `db push`.
- **Access control** is permission-based: gate mutations with `checkJamPermission(jamId, userId, permission)`. Jam roles are **stackable** — effective powers are the union of a user's roles (`getJamRoles` + `hasPermission`). Never inline `role === "ADMIN"`.
- **Moderation** is three independent switches on `Submission` (`visible` / `rateable` / `competing`) + `moderationReason`, applied via presets (disqualify / exclude / hide / reinstate).
- **Submission lifecycle**: DRAFT → SUBMITTED; a submission may only become SUBMITTED once its itch.io link is ownership-verified. Changing the verified link resets it to DRAFT.
- **itch.io fetch** uses a single-host allowlist (`itch.io` / `*.itch.io`), HTTPS only, with per-hop redirect re-validation, a timeout, and a size cap.
- **Auth.js v5 beta.30** uses JWT strategy. No session table.
- **shadcn/ui** uses `@base-ui/react` (NOT Radix). No `asChild` — use `render` prop.
- **Zod v4**: Use `.issues` not `.errors` on `ZodError`.
- **Server Actions**: Colocated in `actions.ts` next to pages.
- **All user input** validated with Zod schemas before database operations.
- **Rate limiting** via `checkRateLimit()` in `src/lib/rate-limit.ts` on all mutating actions.
- **Tests**: unit tests colocated as `*.test.ts` (Vitest); E2E in `e2e/*.spec.ts` (Playwright).
- **`export const dynamic = "force-dynamic"`** is required on any page that queries the DB without `auth()`/`cookies()` (currently: homepage).
- Build must produce **0 errors** before any task is marked done.
- `node_modules/`, `.next/`, `src/generated/` are gitignored.

## Tech Constraints

- Next.js 16.3.4, TypeScript strict mode
- Node.js 24.20.0 (pinned via Volta), pnpm 9.12.3 (pinned via `packageManager`)
- PostgreSQL 16 via Docker
- Tailwind CSS v4 (not v3 — different config format)
- No `any` without inline justification
