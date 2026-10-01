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

- JWT session strategy; no session table.
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
| Abuse | `checkRateLimit()` on every mutating action; search throttled per IP |
| Password storage | bcrypt |
| SSRF (itch.io fetch) | Single-host allowlist (`itch.io`, `*.itch.io`), HTTPS, per-hop redirect re-validation, timeout, size cap |
| Staff mistakes | Soft delete + restore, audit log; mandatory staff TOTP is in the backlog |
