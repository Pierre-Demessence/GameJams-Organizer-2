# Backlog

Everything not done yet, one line each. Tags: `[MVP]` is spec behaviour marked MVP,
`[post-MVP]` comes after it. Pick up a non-trivial item through a `docs/plans/<feature>.md`;
delete the line once it ships.

## MVP gaps

- [MVP] Leave a jam (Joined → Not joined) and leave a submission (Participant → Joined), spec §4.7; rules exist in `src/domain/participation.ts`, actions and UI do not.
- [MVP] Contributor invites with acceptance instead of adding contributors directly, spec §5.
- [MVP] Mandatory TOTP 2FA for staff, independent of the sign-in provider, spec §10; the admin board's "2FA verified" badge and per-staff "2FA on" status wait on it.
- [MVP] Settings → Delete account: needs product rules first (led submissions, organized jams, ratings), since the spec only lets staff delete accounts.
- [MVP] Mobile designs for the organizer screens (host / manage jam, submission editor, sign in) on the design canvas (see `docs/design-system.md`).

## Operations

- Before the first prod release, confirm the prod one-time setup in `docs/deployment.md` (1Password `gamejams-prod`, Discord prod redirect URI, `gamejams.corniland.ovh` DNS).
- Confirm Velero backs up the Postgres PVCs and test a restore.
- Full manual regression pass of the core flows (create jam → submit → verify → rate → results, moderation switches, stacked roles) on the current build.

## Known issues

- Rate limiter is in-memory per pod (`src/lib/rate-limit.ts:7`) while prod runs 2 replicas, so limits are doubled and inconsistent; move to Postgres / Redis or document it.
- `isStaff` is cached in the JWT at sign-in (`src/lib/auth.ts:51`), so a revoked staff role shows in the UI until the next sign-in; actions re-check the DB. Refresh it in the `jwt` callback.
- Dead username generation in the `signIn` callback (`src/lib/auth.ts:76`): `customPrismaAdapter` always sets a username. Remove it.
- `src/components/markdown.tsx:3` renders sanitized raw HTML through `rehype-raw`, but spec §4.1 says raw HTML is escaped. Drop `rehype-raw` or amend the spec.
- Search palette results are listbox options, so middle-click / "open in new tab" does not work (`src/components/search-palette.tsx`).
- Search is `ILIKE '%q%'` (sequential scan); add a `pg_trgm` GIN index on `Jam.name` / `shortDesc` once the table grows (`src/lib/search-queries.ts`).

## Spec proposals

Suggested changes to `docs/specs/product-spec.md`, awaiting a decision.

- itch.io profile verification in the MVP: link the profile once and match the project's `username.itch.io` namespace instead of per-project codes (less friction; scraping may get blocked).
- Date edits after publish: define which dates can change once a jam is live; at least lock dates in the past.
- Prize allocation: all-members approval stalls on one silent member; drop it, or "leader proposes, auto-accepted after N days unless contested".
- Rating eligibility "Everyone" invites fake accounts; pair it with a minimum account age or OAuth-only accounts.
- Organizer edits after the lock: spec §5 locks content at RATING, but `edit_submission` holders can edit in any phase (moderation fixes); confirm or restrict to moderation switches.
- Who transfers leadership: the code lets only the current leader hand it over (leadership decides who rates under "team leader only"); confirm or allow any member.
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
