# Codebase Map

## Top-Level Structure

```
├── docs/               Documentation
│   ├── agent/          Agent operational docs
│   └── specs/          Requirements, design, tasks, draft
├── e2e/                Playwright end-to-end tests (*.spec.ts)
├── prisma/
│   ├── migrations/     SQL migration history
│   ├── schema.prisma   Database schema (single source of truth)
│   └── seed.ts         Database seed script
├── public/             Static assets
├── src/
│   ├── app/            Next.js App Router pages and layouts
│   ├── components/     Shared React components
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
| `layout.tsx` | Root layout (fonts, navbar, footer, Toaster) |
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

## Library Modules (`src/lib/`)

| File | Purpose |
|------|---------|
| `auth.ts` | Auth.js handlers (`signIn`, `signOut`, `auth`) |
| `auth.config.ts` | Auth.js providers and callbacks |
| `db.ts` | Prisma client singleton |
| `permissions.ts` | Permission catalog + `getJamRoles`, `hasPermission`, `checkJamPermission` (stackable roles) |
| `verification.ts` | itch.io ownership verification (single-host allowlist fetch + code generation) |
| `jam-status.ts` | Jam lifecycle status helpers |
| `rate-limit.ts` | In-memory rate limiter for server actions |
| `scoring.ts` | Bayesian per-criterion scores; overall by primary criterion or weighted average |
| `validations.ts` | Zod schemas for forms and server actions |
| `utils.ts` | General utilities (`cn` class merge, etc.) |

### Middleware (`src/middleware.ts`)

Edge middleware that handles auth-related redirects and route protection.

## Components (`src/components/`)

| File | Purpose |
|------|---------|
| `navbar.tsx` | Site-wide navigation bar |
| `footer.tsx` | Site-wide footer |
| `user-menu.tsx` | Authenticated user dropdown menu |
| `ui/` | shadcn/ui primitive components |

## Conventions

- **Server Actions**: Colocated in `actions.ts` files next to the pages that use them.
- **Validation**: All user input validated with Zod schemas from `lib/validations.ts`.
- **Auth checks**: Use `auth()` from `lib/auth.ts` in server components and actions.
- **Access control**: Gate every mutation with `checkJamPermission(jamId, userId, permission)`; never inline `role === "ADMIN"`.
- **Testing**: Unit tests colocated as `*.test.ts` (Vitest); E2E in `e2e/*.spec.ts` (Playwright).
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
| Business logic | `src/lib/` |
| Zod schema | `src/lib/validations.ts` |
| Database model | `prisma/schema.prisma` then `pnpm db:migrate` |
| Unit test | Colocate `*.test.ts` next to the module |
| E2E test | `e2e/*.spec.ts` |
| Type extension | `src/types/` |
