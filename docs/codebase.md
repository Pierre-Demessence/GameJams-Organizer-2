# Codebase Map

## Top-Level Structure

```
├── docs/               Documentation
│   ├── agent/          Agent operational docs
│   └── specs/          Requirements, design, tasks, draft
├── prisma/
│   ├── schema.prisma   Database schema (single source of truth)
│   └── seed.ts         Database seed script
├── public/             Static assets
├── src/
│   ├── app/            Next.js App Router pages and layouts
│   ├── components/     Shared React components
│   ├── generated/      Prisma generated client (gitignored, not committed)
│   ├── lib/            Server-side utilities and business logic
│   ├── types/          TypeScript type extensions
│   └── middleware.ts   Next.js edge middleware (auth redirects)
├── Dockerfile          Multi-stage production build
├── docker-compose.yml  Service orchestration
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
| `jams/[slug]/manage/` | Manage jam members (organizer only) |
| `jams/[slug]/submissions/` | Submit a game to this jam |
| `jams/[slug]/results/` | Jam results/rankings |
| `submissions/[id]/` | Submission detail page |
| `users/[username]/` | Public user profile |
| `settings/` | Account settings (profile, linked accounts) |

## Library Modules (`src/lib/`)

| File | Purpose |
|------|---------|
| `auth.ts` | Auth.js handlers (`signIn`, `signOut`, `auth`) |
| `auth.config.ts` | Auth.js providers and callbacks |
| `db.ts` | Prisma client singleton |
| `permissions.ts` | Jam role checks (`isAdmin`, `isModerator`, etc.) |
| `jam-status.ts` | Jam lifecycle status helpers |
| `rate-limit.ts` | In-memory rate limiter for server actions |
| `scoring.ts` | Bayesian average rating calculations |
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
| Database model | `prisma/schema.prisma` then `npx prisma db push` |
| Type extension | `src/types/` |
