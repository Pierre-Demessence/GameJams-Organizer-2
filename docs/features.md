# Features

## MVP Features

| Feature | Description | Criticality |
|---------|-------------|-------------|
| **Discord OAuth** | Sign in / register via Discord OAuth 2.0 | High |
| **Email/Password Auth** | Register and sign in with email and password | High |
| **User Profiles** | Public profiles with username, bio, avatar, and jam/submission history | Medium |
| **Account Settings** | Edit profile, link/unlink OAuth providers | Medium |
| **Jam Creation** | Create game jams with name, description, dates, themes, rating criteria | High |
| **Jam Lifecycle** | Automatic status transitions: DRAFT → UPCOMING → ONGOING → RATING → FINISHED | High |
| **Jam Browsing** | List and filter jams by status, search by name | High |
| **Jam Roles** | Stackable, permission-based roles (Admin, Moderator, Judge, Host) | High |
| **Join/Leave Jams** | Participants can join during UPCOMING and ONGOING phases | High |
| **Submissions** | Submit games (itch.io link + platforms), DRAFT/SUBMITTED lifecycle, contributors | High |
| **Rating System** | Rate submissions on custom criteria; Bayesian average scoring | High |
| **Results** | View ranked results with scores per criterion after rating period | Medium |
| **Jam Management** | Edit jam details, manage roles, moderate submissions (visible/rateable/competing switches) | Medium |
| **Ownership Verification** | itch.io code-on-page verification required to publish a submission | High |
| **Platform Admin** | Seeded Site Admin, mandatory 2FA, soft-delete + restore, audit log | Medium |
| **Rate Limiting** | In-memory rate limiter on server actions to prevent abuse | Medium |
| **Responsive UI** | Mobile-friendly layout with Tailwind CSS breakpoints | Medium |

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
