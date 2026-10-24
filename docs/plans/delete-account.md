# MVP-4 Settings → Delete account

Roadmap MVP item 4. The product rules below were decided with the user before this plan; the spec
currently lets only staff delete accounts (§10), so this plan also amends §3.

## Goal

A signed-in user can delete their own account from Settings. Their personal data is erased,
past jam history stays intact and is credited to "Deleted user", and live jams are never left
without an organizer or a team without a leader.

## Acceptance criteria

- WHEN a user confirms deletion by typing their username, THE SYSTEM SHALL anonymize the `User`
  row (tombstone: `username` → `deleted-<id>`, `displayName` → "Deleted user", `email`,
  `emailVerified`, `passwordHash`, `bio`, `avatarUrl` → null, `deletedAt` set), delete its
  `Account` rows, and sign the browser out.
- THE SYSTEM SHALL keep the user's ratings, and their memberships of submissions in RATING or
  FINISHED jams, so results and team sizes do not change.
- WHEN the user is in a submission of a jam before RATING, THE SYSTEM SHALL remove a non-leader
  membership and soft-delete a submission they lead alone.
- IF the user leads a submission with other members in a jam before RATING, THEN THE SYSTEM
  SHALL refuse deletion and name the submission ("Transfer leadership of X first").
- IF the user is the only Jam Admin of a published jam that is not FINISHED, THEN THE SYSTEM
  SHALL refuse deletion and name the jam.
- THE SYSTEM SHALL soft-delete DRAFT jams where the user is the only Jam Admin, remove all their
  `JamRole` rows, their `JamParticipant` rows in jams before RATING, and every pending invite
  they sent or received. FINISHED jams stay and show "Deleted user" as organizer.
- IF the user holds a staff role, THEN THE SYSTEM SHALL refuse deletion ("Ask another admin to
  remove your staff role first").
- WHILE a deleted user's JWT is still valid on another device, THE SYSTEM SHALL invalidate it
  at the next staff-claim refresh (within 60 s).
- WHEN anyone opens `/users/deleted-…`, THE SYSTEM SHALL show a "This account was deleted" stub
  (no jams, `noindex`) instead of a profile.
- THE SYSTEM SHALL reject usernames starting with `deleted-` at sign-up and profile edit, and
  exclude deleted users from every username or email lookup that adds someone (invites, jam
  roles, staff grant).
- THE Settings page SHALL show a "Delete account" section that lists what will be removed and
  kept, and every blocker with a link to resolve it, before the confirm step.

## Design

- **Tombstone, not hard delete**: `Jam.createdById` and `AuditLogEntry.actorId` have no cascade,
  and kept ratings and memberships need the row. Irreversible: no restore.
- **Schema**: `User.deletedAt DateTime?`. One SQL migration via `pnpm db:migrate`. No soft-delete
  extension for `User` (the row must stay readable as "Deleted user").
- **Rule** `src/domain/account.ts`: `planAccountDeletion(input)` over plain data (staff flag,
  memberships with phase / isLeader / memberCount / submission deletedAt, jam roles with phase /
  publishedAt / adminCount, participations with phase) returns either `{ allowed: false,
  blockers: { kind, id, name, reason }[] }` or the row operations to apply plus kept counts.
  "Before RATING" means phase DRAFT, UPCOMING or ONGOING (from `jamPhase`). Exhaustive unit tests.
- **Loader** `src/lib/account-queries.ts` `loadAccountDeletion(userId)`: loads that input
  (remember `deletedAt: null` on relation filters), used by the settings page preview and the
  action. Integration-tested.
- **Action** `deleteAccountAction(confirmUsername)` in `src/app/settings/actions.ts`: auth,
  `checkRateLimit`, Zod, username match, then one transaction that locks the user's
  `JamParticipant` rows and the led `Submission` rows (`FOR UPDATE`, participant first, same
  order as `acceptInviteAction`), reloads, re-runs `planAccountDeletion`, applies the ops and
  the tombstone. Returns blockers on refusal. The client then calls `signOut({ callbackUrl: "/" })`.
- **Session**: extend the periodic refresh in `src/lib/staff-claim.ts` (or a sibling called from
  the `jwt` callback in `src/lib/auth.ts`) to read `deletedAt` too and return `null` from the
  callback for a deleted or missing user; check with context7 that Auth.js v5 beta clears the
  session on a `null` return.
- **UI**: last section of `src/app/settings/page.tsx` (add to `SECTIONS`), destructive styling
  from tokens. Check the canvas Settings board (`docs/design-system.md`) for an existing
  danger-zone design and follow it; otherwise a bordered section with the preview list and a
  confirm `Sheet` or inline confirm with the username input. Meaning never by color alone.
- **Lookups**: add `deletedAt: null` in `src/app/admin/actions.ts:21`,
  `src/app/jams/[slug]/manage/actions.ts:26` and `:109`, `src/app/submissions/actions.ts:230`;
  `src/lib/profile-queries.ts:49` returns a deleted marker for the stub.
- **Credentials sign-in** needs no change (`passwordHash` null); a Discord sign-in after deletion
  creates a new account, since the `Account` rows are gone.

## Checklist

- [x] Baseline: `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm build`; note failures.
- [x] Spec: add "Deleting your account" to `docs/specs/product-spec.md` §3 with the rules above;
  add REQ-AUTH-09 to `docs/specs/requirements.md`.
- [x] Migration for `User.deletedAt`; `deleted-` prefix rejected in `usernameSchema`
  (`src/lib/validations.ts`) with a test.
- [x] `src/domain/account.ts` + tests (every blocker, every phase, solo vs team, drafts, staff).
- [x] `src/lib/account-queries.ts` + integration test.
- [x] `deleteAccountAction` + integration tests: each blocker refuses with nothing written; a
  full deletion leaves ratings and frozen memberships, removes the rest, tombstones the row,
  frees the username and email; deleted users are not found by invite / role / staff lookups.
- [x] JWT invalidation + unit test of the refresh helper.
- [x] Settings section, profile stub, lookups.
- [x] Docs: `docs/architecture.md` (account deletion paragraph), `AGENTS.md` invariant
  ("a deleted user is a tombstone; user lookups that add someone filter `deletedAt: null`"),
  `docs/decisions.md` (tombstone over hard delete), delete the MVP backlog line; add "staff
  delete of other accounts (spec §10)" to the backlog if not already there.
- [x] Verify in the browser with seeded users: a blocked case, a full deletion, the profile
  stub, light and dark themes, 390 px width. Back up and restore the dev database around it.
- [x] Lint, unit, integration, build pass with no new problems; peer review (fresh Sonnet,
  read-only) against these criteria.
- [ ] Delete this plan and the roadmap line in the final commit.

## Running alongside MVP-2

`docs/plans/staff-totp.md` also migrates `User`. Run each plan in its own worktree **with its own
databases** (in the worktree's `.env`: `DATABASE_URL=…/gamejams_delete`,
`TEST_DATABASE_URL=…/gamejams_delete_test`), or `prisma migrate dev` and the integration global
setup see the other branch's migrations as drift and offer to reset the shared database. If
MVP-2 lands first, the tombstone also nulls `totpSecret`, `totpEnabledAt` and `totpLastStep`.
