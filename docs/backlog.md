# Backlog

Unscheduled work: MVP gaps, known issues, spec proposals, and post-MVP features —
**not yet committed or broken into tasks**.

When you pick up a backlog item, **promote** it: for anything non-trivial, create a
`docs/plans/<feature>.md` (with its own checklist) and build from there; extremely small
changes can skip straight to a commit. Remove the item from this list once it is promoted.

## MVP gaps

Spec behaviour marked MVP that is not implemented yet. The matching rule functions are
part of [plans/done/domain-layer.md](plans/done/domain-layer.md); the actions and UI below
are not.

1. Leave a jam (Joined → Not joined) and leave a submission (Participant → Joined), spec §4.7.
2. Contributor invites with acceptance, instead of adding contributors directly, spec §5.
3. Mandatory TOTP 2FA for staff, independent of the sign-in provider, spec §10.
4. Restore for soft-deleted jams and submissions, spec §10. The `/admin` page lists deleted
   items, but no restore action exists yet.

## Redesign

The approved design lives on the "GameJam Organizer — Website Design" canvas
(<https://claude.ai/artifact/SPJeNxb9rsAiNeGNoeBXqB>, private to the owner). Foundations,
the app shell and the homepage are done — see
[plans/done/redesign-foundations.md](plans/done/redesign-foundations.md). Still to plan,
one plan per group:

1. **Discover & play:** done — see [plans/done/redesign-discover-play.md](plans/done/redesign-discover-play.md).
   Follow-up: push the "Manage" tab to the right on desktop (`LinkTabs` has no alignment option).
2. **Rate & results:** rating form (1–5 segmented buttons per criterion, "Save & rate
   next"), results (criterion tabs, top-3 cards, ranking table, "Not competing" section).
3. **People & account:** profile, settings (profile, sign-in methods, appearance, delete
   account), sign in / sign up (tabbed).
4. **Organize:** host/edit jam form with the "Ready to publish?" checklist panel, submission
   editor with the itch.io verification card and "Ready to submit?" panel, manage jam
   (results banner, moderation switches table, organizers), platform admin.
5. **Mobile organizer screens:** not designed yet (host/manage jam, submission editor,
   sign in).
6. **Search palette:** the header's "Search jams… ⌘K" opens a command palette. The
   foundations plan ships it as a plain link to `/jams`.
7. **Foundations follow-ups:** check the mobile header at 390px (logo, search, account chip
   and menu may be tight); add a signed-in e2e session covering the account menu (profile
   link, theme picker); guard `await update()` in the settings profile form against a
   network error; add `Number.isFinite` guards for Invalid Date in `phaseProgress` /
   `formatDuration`; the podium row link underlines place and score on hover; the dark
   `--accent` equals `--secondary`, so hover on muted surfaces is flat.

## Known issues

Defects outside the domain-layer plan.

- The rate limiter (`src/lib/rate-limit.ts`) is in-memory per pod, but prod runs 2 replicas,
  so the limits are effectively doubled and inconsistent. Move it to a shared store (Postgres
  or Redis), or accept this and document it.
- `isStaff` is saved in the JWT at sign-in, so revoking a staff role only affects the UI
  after the user signs in again. (Server actions re-check against the database, so this is
  not an access-control hole.) Refresh the value periodically in the `jwt` callback.
- The username generation in the `signIn` callback of `src/lib/auth.ts` never runs
  (`customPrismaAdapter` always sets a username). Remove it.
- `src/components/markdown.tsx` renders sanitized raw HTML through `rehype-raw`, but spec §4.1
  says raw HTML is escaped. Drop `rehype-raw`, or amend the spec.

## Spec proposals

Suggested changes to [product-spec.md](specs/product-spec.md), awaiting a decision.

- **itch.io profile verification in the MVP.** Link the itch.io profile once and match the
  project's `username.itch.io` namespace (any team member linked counts), instead of
  per-project codes. Codes on the page add friction for every entry, and server-side
  scraping of itch.io may get blocked.
- **Date edits after publish.** Define which dates can change once a jam is live; at minimum,
  dates in the past are locked, so a mid-jam edit can't reopen or cut short submissions or
  rating.
- **Prize allocation.** Requiring every team member's approval stalls if one member goes
  silent, and the platform never handles money. Drop the feature, or make it "leader
  proposes, auto-accepted after N days unless contested".
- **Rating eligibility "Everyone".** Invites fake accounts. Pair it with a minimum account age
  or restrict it to OAuth-backed accounts.
- **Organizer edits after the lock.** Spec §5 locks submission content at RATING, while §4.6
  gives Jam Moderators "edit" rights. The code lets holders of `edit_submission` edit in any
  phase (for moderation fixes such as a broken link). Confirm, or restrict it to moderation
  switches only.
- **Who transfers leadership.** Spec §5 gives contributors the same rights over the submission
  as the leader and says leadership "can be transferred". The code lets only the current leader
  hand it over, since leadership decides who rates under "team leader only". Confirm, or allow
  any member to take leadership.
- **Externally hosted images.** Linking images from other hosts leaks viewer IP addresses and
  breaks when the host removes the image. Consider an image proxy, or at least a strict CSP.

## Deprioritized

- [plans/ppr-cache-components-migration.md](plans/ppr-cache-components-migration.md) is on
  hold until the MVP gaps are done. The navigation speed-ups
  already shipped are enough for a prototype.

## Post-MVP features

Roughly prioritized:

1. Theme voting (score voting among options)
2. Email notifications (jam start, end, results)
3. Rating queue / incentives
4. Comments on submissions
5. Community message board per jam
6. Prize listing and team member claiming
7. Late submissions (flagged, non-ranked)
8. Visual calendar UI
9. Verified itch.io profile (auto-verify all projects)
10. JURY criteria and manual placement
11. Site Moderator role, sudo-mode, custom-role builder
12. itch.io OAuth sign-in (implicit-flow bridge; doubles as itch.io profile linking for auto-verify)
13. Google / GitHub OAuth providers
14. In-app notifications
15. Analytics dashboard
16. Organizations (group jams under an organization banner with a shared, reusable organizer roster)

## Ideas

Loose ideas, one line each. Move up into "Post-MVP features" (or a plan) when they firm up.

_None yet._
