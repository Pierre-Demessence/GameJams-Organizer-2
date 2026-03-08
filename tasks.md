---
post_title: "GameJam Organizer 2 — MVP Tasks"
author1: "Pierre"
post_slug: "gamejam-organizer-2-tasks"
summary: "MVP implementation task checklist for the GameJam Organizer 2 platform."
post_date: 2026-03-08
---

## Scope

This task list covers **MVP only**. Features explicitly deferred:
theme voting, notifications, calendar UI, community board,
prizes, submission verification, late submissions, site admin panel, analytics.

---

## Phase 0: Project Setup

- [ ] **T-000** Initialize Next.js project with TypeScript, App Router, `pnpm`
- [ ] **T-001** Configure Tailwind CSS + shadcn/ui
- [ ] **T-002** Set up Prisma with PostgreSQL connection
- [ ] **T-003** Create initial Prisma schema (all models from design.md)
- [ ] **T-004** Run initial migration
- [ ] **T-005** Set up Auth.js (NextAuth v5) with JWT strategy
- [ ] **T-006** Configure Discord OAuth provider
- [ ] **T-007** Configure Credentials provider (email/password with bcrypt)
- [ ] **T-008** Set up Zod validation library
- [ ] **T-009** Create root layout (nav, footer, theme provider)
- [ ] **T-010** Set up Docker + docker-compose (app + PostgreSQL)
- [ ] **T-011** Create `.env.example` with all required environment variables
- [ ] **T-012** Set up ESLint + Prettier config
- [ ] **T-013** Create Prisma seed script with development test data

---

## Phase 1: Authentication & User Profiles

**Depends on: Phase 0**

### Auth

- [ ] **T-100** Build sign-in page (Discord button + email/password form)
- [ ] **T-101** Build sign-up page (email/password registration)
- [ ] **T-102** Implement password hashing (bcrypt, cost ≥ 12)
- [ ] **T-103** Implement auth middleware for protected routes
- [ ] **T-104** Add rate limiting on auth endpoints
- [ ] **T-105** Implement logout flow (terminate session, redirect to homepage)

### Account Merging

- [ ] **T-110** Build account settings page — link/unlink providers section
- [ ] **T-111** Implement "Link Discord" flow (link OAuth to existing account)
- [ ] **T-112** Implement "Add email/password" flow (add credentials to OAuth account)
- [ ] **T-113** Handle conflict: provider already linked to different account → error

### User Profiles

- [ ] **T-120** Build user profile page (`/users/[username]`)
- [ ] **T-121** Build edit profile form (username, display name, bio, avatar URL)
- [ ] **T-122** Implement username uniqueness validation
- [ ] **T-123** Display user's jams and submissions on profile

---

## Phase 2: Jam CRUD & Lifecycle

**Depends on: Phase 1**

### Create & Edit Jam

- [ ] **T-200** Build create jam form (`/jams/new`) with all basic info fields
- [ ] **T-201** Implement server action: create jam (validates, creates jam + admin role)
- [ ] **T-202** Build edit jam page (`/jams/[slug]/edit`)
- [ ] **T-203** Implement slug uniqueness validation + auto-generation from name
- [ ] **T-204** Implement date validation (chronological order enforcement)
- [ ] **T-205** Build jam settings section (ranked toggle, dates, theme, visibility toggles)

### Jam Detail & Listing

- [ ] **T-210** Build jam detail page (`/jams/[slug]`)
- [ ] **T-211** Build jam listing page (`/jams`) with search + status/tag filters
- [ ] **T-212** Implement jam status computation from dates (lazy evaluation)
- [ ] **T-213** Display appropriate content per status (upcoming info, submissions, results)
- [ ] **T-214** Implement "Publish Jam" action (validate required fields, set visibility to
  PUBLISHED — transitions DRAFT → UPCOMING)

### Join Jam

- [ ] **T-220** Add "Join Jam" button (UPCOMING and ONGOING only)
- [ ] **T-221** Implement server action: join jam (create JamParticipant)
- [ ] **T-222** Show participant count on jam page

### Submission Settings

- [ ] **T-230** Build submission settings section in jam edit (max team size, post-close
  contributors, custom fields)
- [ ] **T-231** Implement custom field CRUD (name, description, type, required, private)
- [ ] **T-232** Lock custom fields after submission period ends

---

## Phase 3: Jam Permissions

**Depends on: Phase 2**

- [ ] **T-300** Build manage jam page (`/jams/[slug]/manage`)
- [ ] **T-301** Build role assignment UI (search user, assign Admin/Moderator/Judge/Host)
- [ ] **T-302** Implement server action: assign/remove role
- [ ] **T-303** Prevent removal of creator's Admin role
- [ ] **T-304** Implement permission checking in service layer (reusable `checkJamPermission`)
- [ ] **T-305** Gate all jam management actions behind permission checks
- [ ] **T-306** Display organizers (admins, mods, judges, hosts) on jam page

---

## Phase 4: Submissions & Teams

**Depends on: Phase 2, Phase 3**

### Create & Edit Submission

- [ ] **T-400** Build create submission form (`/jams/[slug]/submissions/new`)
- [ ] **T-401** Implement server action: create submission (validates dates, one-per-user check)
- [ ] **T-402** Render custom fields in submission form (respecting field types)
- [ ] **T-403** Build submission detail page (`/submissions/[id]`)
- [ ] **T-404** Build edit submission page (`/submissions/[id]/edit`)
- [ ] **T-405** Hide private custom field values from non-organizers/judges
- [ ] **T-406** Lock submission editing during RATING and FINISHED statuses

### Submission Listing

- [ ] **T-410** Build submission list on jam page (`/jams/[slug]/submissions`)
- [ ] **T-411** Respect "hide submissions before end" setting
- [ ] **T-412** Show disqualification badge on disqualified submissions

### Contributors / Teams

- [ ] **T-420** Build invite contributor UI on submission page
- [ ] **T-421** Implement server action: add contributor (checks max team size, one-per-jam)
- [ ] **T-422** Implement server action: remove contributor
- [ ] **T-423** Implement team leader transfer
- [ ] **T-424** Lock contributor changes during rating period (with exception per jam setting)

### Submission Moderation

- [ ] **T-430** Add disqualify/hide/delete actions for admins and moderators
- [ ] **T-431** Implement server actions: disqualify, hide, delete submission
- [ ] **T-432** Exclude disqualified submissions from ratings

---

## Phase 5: Rating System (Ranked Jams)

**Depends on: Phase 4**

### Criteria

- [ ] **T-500** Build criteria management UI in jam edit (name, description, weight)
- [ ] **T-501** Implement server action: CRUD criteria

### Rating UI

- [ ] **T-510** Build rating page (`/jams/[slug]/rate`) — shows submission + criteria sliders
- [ ] **T-511** Implement rating eligibility check per jam setting
- [ ] **T-512** Implement self-rating prevention
- [ ] **T-513** Implement server action: submit/update ratings (1-5 per criterion)
- [ ] **T-514** Allow updating existing ratings during rating period
- [ ] **T-515** Block rating outside of RATING status

### Results Computation

- [ ] **T-520** Implement Bayesian average scoring algorithm (per design.md)
- [ ] **T-521** Implement tiebreaking logic
- [ ] **T-522** Store computed results in JamResult table
- [ ] **T-523** Build results page (`/jams/[slug]/results`)
- [ ] **T-524** Respect "hide results" setting (show only to admins when enabled)
- [ ] **T-525** Display per-criterion scores alongside final rank

---

## Phase 6: Homepage & Polish

**Depends on: Phase 5**

- [ ] **T-600** Build homepage with featured/upcoming jams
- [ ] **T-601** Add responsive design pass (mobile breakpoints)
- [ ] **T-602** Build 404 and error pages
- [ ] **T-603** Add loading states and skeleton UIs
- [ ] **T-604** Sanitize all Markdown rendering (rehype-sanitize)
- [ ] **T-605** Server-side input validation pass (Zod on all server actions)
- [ ] **T-606** Add rate limiting middleware on form submissions
- [ ] **T-607** Test full jam lifecycle end-to-end (create → join → submit → rate → results)

---

## Phase 7: Deployment

**Depends on: Phase 6**

- [ ] **T-700** Finalize Dockerfile (multi-stage build, standalone output)
- [ ] **T-701** Finalize docker-compose.yml (app + PostgreSQL)
- [ ] **T-702** Document deployment steps in README
- [ ] **T-703** Set up production environment variables
- [ ] **T-704** Test deployment on VPS
- [ ] **T-705** Set up database backups

---

## Post-MVP Backlog (Not In Scope)

For reference — features deferred from MVP, roughly prioritized:

1. Theme voting (community YES/NO/N/A voting)
2. Email notifications (jam start, end, results)
3. Rating queue / karma system
4. Submission verification (code-on-page)
5. Community message board per jam
6. Prize listing and team member claiming
7. Late submissions (flagged, non-ranked)
8. Visual calendar UI
9. Site admin/moderator panel
10. Analytics dashboard
11. Google/GitHub OAuth providers
12. In-app notifications
