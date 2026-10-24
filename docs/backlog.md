# Backlog

Everything not done yet, one line each. Tags: `[MVP]` is spec behaviour marked MVP,
`[post-MVP]` comes after it. Pick up a non-trivial item through a `docs/plans/<feature>.md`;
delete the line once it ships.

## MVP gaps

- [MVP] Mobile designs for the organizer screens (host / manage jam, submission editor, sign in) on the design canvas (see `docs/design-system.md`).

## Operations

- Before the first prod release, confirm the prod one-time setup in `docs/deployment.md` (1Password `gamejams-prod`, Discord prod redirect URI, `gamejams.corniland.ovh` DNS).
- Confirm Velero backs up the Postgres PVCs and test a restore.
- Full manual regression pass of the core flows (create jam → submit → verify → rate → results, moderation switches, stacked roles) on the current build.

## Known issues

- `src/components/markdown.tsx:3` renders sanitized raw HTML through `rehype-raw`, but spec §4.1 says raw HTML is escaped. Drop `rehype-raw` or amend the spec.
- Search palette results are listbox options, so middle-click / "open in new tab" does not work (`src/components/search-palette.tsx`).
- `docker-compose.yml` publishes no port for `db`, but `README.md` and `docs/configuration.md` expect it on `localhost:5432`, so `docker compose up db -d` alone leaves the dev server and integration tests unable to connect. Add a `127.0.0.1:5432:5432` mapping (or a dev override file) or fix the docs.
- `createSubmissionAction` does not lock the participant row, so a create racing `leaveJamAction` can leave a submission by a user who is no longer joined, and a create racing `acceptInviteAction` (or a second create) can put one user on two live submissions; lock and re-check inside the transaction the way `acceptInviteAction` does (`src/app/submissions/actions.ts`).
- `inviteContributorAction` looks the invitee up before checking that the caller is a team member, so a non-member can probe whether a username exists; check membership first (`src/app/submissions/actions.ts`).
- Invite, accept and leave-jam inputs (usernames, invite ids) are not Zod-validated, unlike the rest of the actions.
- Team integration tests lack: accept during RATING with `allowContributorsAfterClose`, leave-submission refusal in that same state, `leaveJamAction` concurrency, and cancel/decline after the window closes.
- The jam page's "joined" panel says "Submissions open when the jam starts" in RATING and FINISHED too (`src/app/jams/[slug]/page.tsx`); the copy only fits UPCOMING.
- Account deletion removes the user's `JamRole` rows even in trashed jams, so restoring a trashed jam they alone administered leaves it without an admin, and a trashed submission they led keeps the tombstone as leader (`src/app/settings/actions.ts`); staff can repair both by hand.
- A deleted account's session stays valid for up to 60 s (`src/lib/staff-claim.ts`), and only `deleteAccountAction`, `updateProfileAction` and `linkPasswordAction` check `deletedAt`; the other mutating actions still trust `session.user.id` in that window. Add a central "user is alive" check (a `requireLiveUser()` helper or in `auth()`).
- `assignRoleAction` and `removeRoleAction` take no `Jam` row lock, so concurrent ADMIN changes can leave a jam without an admin, and can race `deleteAccountAction`'s admin-count check (`src/app/jams/[slug]/manage/actions.ts`); lock the jam row (`FOR NO KEY UPDATE`) and re-check inside the transaction.
- Search is `ILIKE '%q%'` (sequential scan); add a `pg_trgm` GIN index on `Jam.name` / `shortDesc` once the table grows (`src/lib/search-queries.ts`).

## Spec proposals

Suggested changes to `docs/specs/product-spec.md`, awaiting a decision.

- itch.io profile verification in the MVP: link the profile once and match the project's `username.itch.io` namespace instead of per-project codes (less friction; scraping may get blocked).
- Date edits after publish: define which dates can change once a jam is live; at least lock dates in the past.
- Prize allocation: all-members approval stalls on one silent member; drop it, or "leader proposes, auto-accepted after N days unless contested".
- Rating eligibility "Everyone" invites fake accounts; pair it with a minimum account age or OAuth-only accounts.
- Organizer edits after the lock: spec §5 locks content at RATING, but `edit_submission` holders can edit in any phase (moderation fixes); confirm or restrict to moderation switches.
- Externally hosted images leak viewer IPs and break when removed; consider an image proxy or at least a strict CSP.

## Deferred

- Cache Components (PPR) migration to remove first-visit skeletons; on hold until the MVP gaps are done (see `docs/decisions.md`).

## Post-MVP features

Roughly prioritized:

1. [post-MVP] Theme voting (score voting among options)
2. [post-MVP] Email notifications (jam start, end, results)
3. [post-MVP] Rating queue / incentives
4. [post-MVP] Comments on submissions
5. [post-MVP] Community message board per jam
6. [post-MVP] Prize listing and team member claiming
7. [post-MVP] Late submissions (flagged, non-ranked)
8. [post-MVP] Visual calendar UI
9. [post-MVP] Verified itch.io profile (auto-verify all projects)
10. [post-MVP] JURY criteria and manual placement
11. [post-MVP] Site Moderator role, sudo-mode, custom-role builder
12. [post-MVP] itch.io OAuth sign-in (implicit-flow bridge; doubles as profile linking for auto-verify)
13. [post-MVP] Google / GitHub OAuth providers
14. [post-MVP] In-app notifications
15. [post-MVP] Analytics dashboard
16. [post-MVP] Organizations (group jams under a shared, reusable organizer roster)
17. [post-MVP] Password reset by email (REQ-AUTH-08)
18. [post-MVP] Staff delete of other accounts (spec §10)
19. [post-MVP] Staff 2FA recovery codes (today a lost authenticator needs another Site Admin or a SQL step), and 2FA for non-staff accounts
