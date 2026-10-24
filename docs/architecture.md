# Architecture

How the MVP fits together. Product rules come from [product-spec.md](specs/product-spec.md);
the data model is [prisma/schema.prisma](../prisma/schema.prisma); the reasons behind these
choices are in [decisions.md](decisions.md).

## Layers

```
Browser ── Next.js App Router (RSC pages + Server Actions)
              │
              ├─ src/domain/   pure spec rules → Decision { allowed, reason }
              ├─ src/lib/      I/O: db (Prisma + soft-delete extension), auth, queries, helpers
              │
           Prisma Client ── PostgreSQL
```

A request loads data through `src/lib`, asks a `src/domain` rule whether the action is
allowed, then writes or renders. Rules never touch the database, `auth()` or Next.js.

## Authentication

```
Sign in with Discord  → Auth.js Discord provider → upsert User + link Account → JWT cookie
Sign in with email    → Auth.js Credentials provider → bcrypt check → JWT cookie
Link another provider → Settings → Auth.js links the Account to the current User
                        (error if that provider account belongs to another user)
```

- JWT session strategy; no session table. The `jwt` callback re-reads `isStaff` from the database
  at most every 60 seconds (`staffCheckedAt` on the token, `src/lib/staff-claim.ts`); the edge
  middleware uses `auth.config.ts` and never touches the database.
- The same refresh checks the account still exists: for a deleted or missing user the `jwt`
  callback returns `null`, which ends the session on that device within a minute.
- Custom sign-in / sign-up pages under `src/app/(auth)/`.
- `INITIAL_ADMIN_EMAILS` grants Site Admin on sign-in (see [configuration.md](configuration.md)).

## Jam lifecycle

```
         publish
  DRAFT ──────────► UPCOMING ──start──► ONGOING ──end──┬─(non-ranked)──► FINISHED
                                                       └─(ranked)──► RATING ──rating end──► FINISHED
```

The phase is never stored. `jamPhase` (`src/domain/jam-phase.ts`):

```
if publishedAt is null or dates are missing → DRAFT
if now < startDate → UPCOMING
if now < endDate → ONGOING
if ranked and now < ratingEnd → RATING
→ FINISHED
```

**Publish** (`canPublish`) sets `publishedAt`. It requires complete, ordered dates (plus a
rating end for ranked jams) and, for ranked jams, at least one criterion and either a primary
criterion or a RATED criterion with non-zero weight. Once published, a jam must keep a
complete schedule.

`visibility` is independent of the lifecycle: listings show jams that are published **and**
PUBLIC; an UNLISTED published jam runs its full lifecycle and is reachable by URL only.

## Teams and invites

Members of a submission invite joined users by username (`inviteContributorAction`); the invite is
a `SubmissionInvite` row that exists only while pending, so accept, decline and cancel delete it.
`isContributorWindowOpen` (`src/domain/submission.ts`) is the one window rule, shared by inviting,
accepting and the loaders in `src/lib/invite-queries.ts`: a closed window or a deleted submission
hides the invites without deleting them.

`acceptInviteAction` and `leaveJamAction` run in a transaction that first locks the invitee's
`JamParticipant` row, and accept also locks the `Submission` row. The single-submission rule
and `maxTeamSize` are checked against that locked state, which keeps concurrent accepts from
overfilling a team or one user accepting two invites. `createSubmissionAction` does not take the
lock, so a create racing an accept is not serialized.

## Account deletion

`deleteAccountAction` (`src/app/settings/actions.ts`) anonymizes the `User` row in place: username
`deleted-<id>`, display name "Deleted user", `email`, `passwordHash`, `bio`, `avatarUrl` and the
`Account` rows gone, `deletedAt` set. The row stays because ratings, kept memberships,
`Jam.createdById` and `AuditLogEntry.actorId` point at it. There is no restore, and `User` has no
soft-delete extension (the row must stay readable as "Deleted user").

`planAccountDeletion` (`src/domain/account.ts`) decides over plain data from `loadAccountDeletion`
(`src/lib/account-queries.ts`): blockers, or the row operations. The settings page shows the same
plan as a preview; the action reloads it inside a transaction that first locks the user's
`JamParticipant` rows, then the submissions they lead, then the jams they administer (all ordered by
id), so a concurrent accept or a co-admin deleting at the same time cannot make the plan stale.
Profile URLs starting with `deleted-` render a stub without a query (`isDeletedUsername`).

## Rating and results

Results are computed on read: `loadJamResults` (`src/lib/scoring.ts`) loads the jam's
criteria, SUBMITTED submissions and ratings, and `rankSubmissions` (`src/domain/scoring.ts`)
ranks them.

1. Rank only competing, rateable submissions; rank-excluded ones are listed separately.
2. For each RATED criterion: `C` = global mean of its scores, `m` = median rating count per
   submission, and for each submission with `v` ratings averaging `R`:
   `WS = (v × R + m × C) / (v + m)`. Rank by `WS`.
3. Overall ranking: the primary criterion's ranking if one is set; otherwise
   `Σ(WS × weight) / Σ(weight)` over RATED criteria with weight > 0; otherwise none.
4. Tiebreak: more ratings, then higher raw mean, then a hash of the submission id.
   Per-criterion rankings use the same tiebreak on that criterion's count and mean.

Hidden submissions (`visible: false`) are ranked but dropped from every displayed result.
For the MVP all criteria are RATED; JURY criteria are post-MVP.

`resultsAccess` (`src/domain/results.ts`) decides who sees results:

| Viewer | RATING | FINISHED | FINISHED, hidden | FINISHED, hidden + revealed |
| --- | --- | --- | --- | --- |
| Public | none | public | none | public |
| Holder of `preview_results` (Admin, Moderator) | preview | public | preview | public |

A Jam Admin reveals hidden results once the jam is FINISHED, which sets `resultsRevealedAt`.

## Security

| Concern | Mitigation |
| --- | --- |
| XSS in Markdown | `rehype-sanitize` on GFM output (`src/components/markdown.tsx`) |
| CSRF | Server Actions' built-in origin check |
| SQL injection | Prisma parameterized queries only |
| Broken access control | Permission-catalog check before every mutation (jam and platform) |
| Abuse | `checkRateLimit()` on every mutating action (fixed 15-minute window per key, counted in the Postgres `RateLimit` table so all replicas share it); search throttled per IP |
| Password storage | bcrypt |
| SSRF (itch.io fetch) | Single-host allowlist (`itch.io`, `*.itch.io`), HTTPS, per-hop redirect re-validation, timeout, size cap |
| Staff mistakes | Soft delete + restore, audit log; mandatory staff TOTP is in the backlog |
