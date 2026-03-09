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
| **Jam Roles** | Admin, Moderator, Judge, Host roles with granular permissions | High |
| **Join/Leave Jams** | Participants can join during UPCOMING and ONGOING phases | High |
| **Submissions** | Submit games with title, description, links, and optional contributors | High |
| **Rating System** | Rate submissions on custom criteria; Bayesian average scoring | High |
| **Results** | View ranked results with scores per criterion after rating period | Medium |
| **Jam Management** | Edit jam details, manage members, moderate submissions | Medium |
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
| Submission Verification | Code-on-page verification |
| Late Submissions | Accept submissions after deadline with penalty |
| Site Admin Panel | Global moderation and user management |
| Analytics Dashboard | Jam and submission statistics |
| Password Reset | Email-based password recovery flow |
