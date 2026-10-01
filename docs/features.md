# Features

## MVP Features

| Feature | Description | Criticality |
|---------|-------------|-------------|
| **Discord OAuth** | Sign in / register via Discord OAuth 2.0 | High |
| **Email/Password Auth** | Register and sign in with email and password | High |
| **User Profiles** | Public profiles: avatar, bio, stats, games with their placement, and public jams with the user's roles | Medium |
| **Account Settings** | Edit profile, link/unlink Discord, set or change the password, pick the theme | Medium |
| **Jam Creation** | Host a jam: sectioned form with Markdown preview, tags, ranked/showcase format, inline criteria and custom questions, and a "Ready to publish?" checklist | High |
| **Jam Lifecycle** | Explicit publish out of DRAFT, then phases derived from dates: UPCOMING → ONGOING → RATING → FINISHED | High |
| **Jam Browsing** | Status tabs with counts, search, tags, format and sort, paging | High |
| **Jam submissions tab** | Filter by platform, hide rated games, least-rated-first "Rate next game" | Medium |
| **Jam Roles** | Stackable, permission-based roles (Admin, Moderator, Judge, Host) | High |
| **Join Jams** | Participants can join during UPCOMING and ONGOING phases | High |
| **Submissions** | Submission editor with the itch.io verification card, jam questions, team roster and a "Ready to submit?" checklist; DRAFT/SUBMITTED lifecycle; the leader can delete while the jam runs | High |
| **Markdown** | Sanitized GFM for jam and submission descriptions, with a live preview in the jam form | Medium |
| **Rating System** | Score every criterion 1–5 with segmented buttons; "Save & rate next" follows the least-rated queue; Bayesian average scoring | High |
| **Results** | Live-computed rankings: overall and per-criterion tabs, top-3 podium, ranking table, "Not competing" section; organizer preview during rating, optional hide-and-reveal | Medium |
| **Jam Management** | Manage tab: results banner (preview / reveal), submissions table with moderation presets, organizers and their roles, delete jam | Medium |
| **Ownership Verification** | itch.io code-on-page verification required to publish a submission | High |
| **Rate Limiting** | In-memory rate limiter on server actions to prevent abuse | Medium |
| **Visual design & themes** | Dark-first design with a light theme; homepage with live jam panel, upcoming schedule and recent results; account menu with profile, settings, theme and sign out | Medium |
| **Responsive UI** | Mobile-friendly layout with Tailwind CSS breakpoints | Medium |
| **Automated Tests** | Vitest unit tests + Playwright E2E, run in CI | Medium |

## MVP — Not Yet Built

Defined as MVP in the spec but not yet implemented (tracked in
[specs/tasks.md](specs/tasks.md)):

| Feature | Description |
|---------|-------------|
| Platform Admin | `/admin`: deleted content with restore, filtered audit log, staff. Still missing: mandatory 2FA |
| Leave Jam / Submission | Rules exist in `src/domain/participation.ts`; actions and UI are in the [backlog](backlog.md) |
| Contributor Invites | Invite-and-accept flow for contributors (currently added directly) |

## Deferred to Post-MVP

| Feature | Description |
|---------|-------------|
| Theme Voting | Community-driven theme selection |
| Notifications | Email/in-app reminders for jam events |
| Calendar UI | Visual calendar for upcoming jams |
| Community Board | Discussion forums per jam |
| Prize System | Define and display jam prizes |
| Late Submissions | Accept submissions after deadline (rank-excluded by default) |
| Verified itch.io Profile | Auto-verify all projects under a linked profile |
| JURY Criteria | Manually placed rankings |
| Site Moderator Role | Reversible-subset staff role, sudo-mode, custom-role builder |
| Analytics Dashboard | Jam and submission statistics |
| Password Reset | Email-based password recovery flow |
