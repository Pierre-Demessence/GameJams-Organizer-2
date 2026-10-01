# Decisions

Non-obvious decisions: what was chosen, why, and what was rejected.

## Architecture

### Rules live in a pure domain layer

Every spec rule of the form "who can do what, in which phase" is a pure function in
`src/domain/` over plain data plus `now`, returning a `Decision` (`{ allowed: true }` or
`{ allowed: false, reason }`). Actions and pages load data, call the rule and surface `reason`.

- **Why:** one source of truth per rule, exhaustively unit-testable without a database. The
  inline versions had drifted apart (draft jams going live, results public during rating,
  judges unable to rate).
- **Rejected:** checks inlined in server actions and pages.

### Jam phase is derived, never stored

`jamPhase()` computes DRAFT / UPCOMING / ONGOING / RATING / FINISHED from `publishedAt` and the
dates. `jamPhaseWhere()` is its SQL mirror for list queries. Visibility (PUBLIC / UNLISTED) is a
separate setting, unrelated to the lifecycle.

- **Why:** a stored status went stale and was never written; publishing changed visibility as a
  side effect.
- **Rejected:** a `Jam.status` enum column updated by actions or a job.

### Results are computed on read

`loadJamResults` ranks on every read; there is no results table. `resultsAccess` decides who sees
them, and a reveal action sets `resultsRevealedAt` for "hide results" jams.

- **Why:** results can never be stale or missing, and organizers have nothing to click. Jam
  scale keeps the cost negligible.
- **Rejected:** a stored `JamResult` table filled by a manual "compute results" button.

### Scoring uses a Bayesian average with the median rating count

Per criterion, `WS = (v × R + m × C) / (v + m)` where `v` and `R` are the entry's rating count
and mean, `C` the criterion's global mean and `m` the median rating count across competing
entries. Overall = the primary criterion's ranking, else the weighted average of RATED
criteria. Ties: more ratings, then higher raw mean, then a SHA-256 hash of the submission id.

- **Why:** a lone 5/5 cannot top a well-rated entry; the hash tiebreak is stable across reads.
- **Rejected:** raw mean (rewards few ratings); random tiebreak (rankings change per request).

### Soft delete is a Prisma client extension

`src/lib/db.ts` filters top-level `Jam` and `Submission` reads on `deletedAt = null` unless the
query names `deletedAt`. Relation filters, includes and `_count` are not covered.

- **Why:** ad-hoc `deletedAt: null` filters were missed in places (deleted submissions counted
  as team memberships, links to deleted entries).
- **Rejected:** per-query filters everywhere.

### Jam roles are stackable permission bundles

`JamRole` is unique on `(jamId, userId, role)`; effective powers are the union of a user's
roles, checked through `checkJamPermission`.

- **Why:** the spec lets one person be, say, Moderator and Judge on the same jam.
- **Rejected:** one role per user per jam, and `role === "ADMIN"` checks.

### Server Actions for mutations

Mutations are Server Actions colocated with their pages; API routes exist only for external
callers (`/api/auth`, `/api/health`). Read helpers live in `src/lib/`, because every export of a
`"use server"` file is a public endpoint.

- **Why:** type-safe, CSRF-protected by Next.js, no hand-written client fetch layer.

### Page data: queries vs pure helpers

Each page has a loader in `src/lib/*-queries.ts` (integration-tested, excluded from unit
coverage) and pure presentation helpers in `src/lib/*.ts` (unit-tested). Components stay thin.

- **Why:** pure logic gets fast exhaustive tests; database reads get real-Postgres tests.

### JWT sessions

Auth.js runs the JWT strategy; there is no session table.

- **Why:** stateless, no session cleanup.
- **Cost:** values cached in the token (`isStaff`) go stale until the next sign-in (see backlog).

### Media by URL only

Covers, screenshots and avatars are external URLs; the app stores no files.

- **Why:** no storage service to run or pay for.
- **Cost:** external hosts see viewer IPs and images can disappear (see backlog).

### Cache Components (PPR) is not adopted yet

Next 16 folds partial prerendering into the global `cacheComponents` flag. Enabling it forbids
`export const dynamic = "force-dynamic"` (used by `src/app/page.tsx` and `/api/health`) and
requires every dynamic read (`auth()`, `params`, `searchParams`, DB, `new Date()`) to sit in a
`<Suspense>` boundary or a `'use cache'` function, on every route, or the build fails.

- **Why deferred:** the gain is only the first-visit skeleton; revisits are already instant
  through the `staleTimes` router cache. The flag is app-wide and experimental, so the
  regression surface is large for a prototype.
- **Rejected alternative:** client-side fetching (SWR / React Query) per page.

## Testing

### Integration tests hit a real Postgres

`pnpm test:integration` runs against a dedicated `gamejams_test` database on the docker-compose
Postgres (`TEST_DATABASE_URL`), created and migrated in global setup, with every table truncated
before each test and files run serially. Only `@/lib/auth`, `next/cache` and
`next/navigation` are mocked.

- **Why:** authorization branches and resulting DB state are what matter; mocking Prisma would
  test the mocks.
- **Rejected:** covering these through Playwright only (slower, can't reach every branch).

## Dependencies

### Version holds

- Node 24 LTS, not 26 (still Current, marginal benefit).
- Prisma 7, not 8 (release candidate and a full ORM rewrite).
- TypeScript 5.9 and ESLint 9: TypeScript 7 crashes `typescript-eslint`, which has no
  supporting release yet.

## Deployment

### Kubernetes via ArgoCD on the Corniland cluster

Manifests live in this repo under `k8s/<env>/`; ArgoCD Applications in the cluster repo sync
them. Each env has its own in-cluster Postgres (StatefulSet + PVC, backed up by Velero),
secrets come from 1Password through External Secrets, and migrations run as an ArgoCD
Sync-hook Job using a dedicated migrator image (Prisma CLI + migrations).

- **Why:** matches the cluster's existing app pattern; no managed database to pay for.

### Commit-back GitOps with immutable tags

CI builds `:<sha>` images, rewrites the `image:` tags in `k8s/<env>/` and commits to `main` with
a GitHub App token (allowed past the PR-required ruleset). The dev trigger ignores `k8s/**`,
which prevents the bump commit from looping.

- **Why:** ArgoCD only rolls on a manifest change, and pinned tags make rollback a revert.
- **Rejected:** a moving `:latest` tag plus manual restarts. ArgoCD Image Updater was left
  unexplored.
