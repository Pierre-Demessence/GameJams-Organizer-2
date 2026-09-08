# Integration tests (server actions against a test DB)

## Goal

Cover the authorization + data-integrity logic in server actions that unit tests
can't reach and that e2e only smoke-tests. First target: the **jam actions
authorization matrix** (`edit_jam`, `delete_jam`, `manage_roles` gating).

These run against a **real Postgres test database**, calling server actions
directly (no browser), which is faster than e2e and lets us exhaustively assert
permission branches and resulting DB state.

## Decisions (agreed)

- **Test DB**: reuse the docker-compose Postgres, dedicated `gamejams_test`
  database (`TEST_DATABASE_URL`, default
  `postgresql://gamejams:gamejams@localhost:5432/gamejams_test`).
- **Isolation**: truncate all tables (except `_prisma_migrations`) before each test.
- **Location**: `integration/` dir, own config + `pnpm test:integration`, kept out
  of the fast unit run and out of the unit-coverage scope.
- **Mocks**: `@/lib/auth` (control the acting session), `next/cache`
  (`revalidatePath` no-op), `next/navigation` (`redirect`). The DB is real.

## Design

- `integration/current-session.ts` — mutable session holder + `actingAs(userId)` /
  `signOut()` helpers.
- `integration/global-setup.ts` — vitest `globalSetup`: create `gamejams_test` if
  missing, then `prisma migrate deploy` against it.
- `integration/setup.ts` — vitest `setupFiles`: point `DATABASE_URL` at the test
  DB, mock auth/cache/navigation, truncate all tables `beforeEach`.
- `vitest.integration.config.mts` — `include: integration/**/*.test.ts`,
  `fileParallelism: false` (shared DB), larger timeout.
- `integration/factories.ts` — small helpers to create users / jams / roles.

## Checklist

- [x] Plan doc (this file)
- [x] `current-session.ts` holder + helpers
- [x] `global-setup.ts` (create DB + migrate)
- [x] `setup.ts` (env + mocks + truncate)
- [x] `factories.ts` (user/jam/role helpers)
- [x] `vitest.integration.config.mts`
- [x] `integration/jam-actions.integration.test.ts` — authorization matrix:
  - [x] `updateJamAction`: signed-out / non-member / MODERATOR denied; ADMIN allowed (+ DB updated)
  - [x] `softDeleteJamAction`: non-member denied; ADMIN allowed; SITE_ADMIN staff allowed (+ audit)
  - [x] `assignRoleAction` / `removeRoleAction`: non-ADMIN denied; ADMIN allowed
- [x] `test:integration` script
- [x] Local run green
- [x] CI job (Postgres service + migrate + run)
- [x] Peer review + docs (`docs/INDEX.md`, tech-stack/codebase testing notes)
