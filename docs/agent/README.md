---
last-updated: 2025-07-10
applicable: ["**"]
owner: Pierre
---

# Agent Operational Guide

## Purpose

AI agent reference for the GameJam Organizer 2 codebase. Read this on-demand before making changes.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (port 3000) |
| `pnpm build` | Production build (standalone output) |
| `pnpm lint` | ESLint check |
| `pnpm format` | Prettier format |
| `npx prisma db push` | Push schema to database (no migration files) |
| `pnpm db:migrate` | Create and apply migrations (`prisma migrate dev`) |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:seed` | Seed the database |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `docker compose up -d --build` | Build and start production stack |
| `docker compose run --rm migrate` | Run DB migration in Docker |

## Important Paths

| Path | Description |
|------|-------------|
| `prisma/schema.prisma` | Database schema (single source of truth) |
| `src/lib/auth.ts` | Auth.js exports (`auth`, `signIn`, `signOut`) |
| `src/lib/auth.config.ts` | Auth providers and callbacks |
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/validations.ts` | All Zod schemas |
| `src/lib/permissions.ts` | Role-based access control |
| `src/app/` | All pages and server actions |
| `src/components/ui/` | shadcn/ui components |
| `docs/specs/` | Requirements, design, tasks |

## Invariants

- **Prisma client** is imported from `@/generated/prisma/client`, wrapped by `@/lib/db`.
- **Auth.js v5 beta.30** uses JWT strategy. No session table.
- **shadcn/ui** uses `@base-ui/react` (NOT Radix). No `asChild` — use `render` prop.
- **Zod v4**: Use `.issues` not `.errors` on `ZodError`.
- **Server Actions**: Colocated in `actions.ts` next to pages.
- **All user input** validated with Zod schemas before database operations.
- **Rate limiting** via `checkRateLimit()` in `src/lib/rate-limit.ts` on all mutating actions.
- **`export const dynamic = "force-dynamic"`** is required on any page that queries the DB without `auth()`/`cookies()` (currently: homepage).
- Build must produce **0 errors** before any task is marked done.
- `node_modules/`, `.next/`, `src/generated/` are gitignored.

## Tech Constraints

- Next.js 16.1.6, TypeScript strict mode
- pnpm 9.12.3 (pinned via `packageManager` in package.json)
- PostgreSQL 16 via Docker
- Tailwind CSS v4 (not v3 — different config format)
- No `any` without inline justification
