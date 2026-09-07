# GameJam Organizer 2 — MVP Tasks

This task list covers the **MVP** as defined by [product-spec.md](./product-spec.md), with EARS
detail in [requirements.md](./requirements.md) and the target schema in [design.md](./design.md).

Phases 0–7 were delivered by the original prototype. Phase 8 tracks the **spec-alignment
refactor** that brings the prototype in line with the refined spec; its execution is sequenced in
[../plans/refactor-restart.md](../plans/refactor-restart.md).

## Scope

Features deferred beyond MVP: theme voting, notifications, calendar UI, community board, comments,
prizes, late submissions, verified itch.io profile, JURY criteria, rating queue, Site Moderator
role / sudo-mode / custom-role builder, Google/GitHub OAuth, analytics.

---

## Phase 0: Project Setup

- [x] **T-000** Initialize Next.js project with TypeScript, App Router, `pnpm`
- [x] **T-001** Configure Tailwind CSS + shadcn/ui
- [x] **T-002** Set up Prisma with PostgreSQL connection
- [x] **T-003** Create initial Prisma schema (all models from design.md)
- [x] **T-004** Run initial migration (via `prisma db push`)
- [x] **T-005** Set up Auth.js (NextAuth v5) with JWT strategy
- [x] **T-006** Configure Discord OAuth provider
- [x] **T-007** Configure Credentials provider (email/password with bcrypt)
- [x] **T-008** Set up Zod validation library
- [x] **T-009** Create root layout (nav, footer, theme provider)
- [x] **T-010** Set up Docker + docker-compose (app + PostgreSQL)
- [x] **T-011** Create `.env.example` with all required environment variables
- [x] **T-012** Set up ESLint + Prettier config
- [x] **T-013** Create Prisma seed script with development test data

---

## Phase 1: Authentication & User Profiles

**Depends on: Phase 0**

### Auth

- [x] **T-100** Build sign-in page (Discord button + email/password form)
- [x] **T-101** Build sign-up page (email/password registration)
- [x] **T-102** Implement password hashing (bcrypt, cost ≥ 12)
- [x] **T-103** Implement auth middleware for protected routes
- [x] **T-104** Add rate limiting on auth endpoints
- [x] **T-105** Implement logout flow (terminate session, redirect to homepage)

### Account Merging

- [x] **T-110** Build account settings page — link/unlink providers section
- [x] **T-111** Implement "Link Discord" flow (link OAuth to existing account)
- [x] **T-112** Implement "Add email/password" flow (add credentials to OAuth account)
- [x] **T-113** Handle conflict: provider already linked to different account → error

### User Profiles

- [x] **T-120** Build user profile page (`/users/[username]`)
- [x] **T-121** Build edit profile form (username, display name, bio, avatar URL)
- [x] **T-122** Implement username uniqueness validation
- [x] **T-123** Display user's jams and submissions on profile

---

## Phase 2: Jam CRUD & Lifecycle

**Depends on: Phase 1**

### Create & Edit Jam

- [x] **T-200** Build create jam form (`/jams/new`) with all basic info fields
- [x] **T-201** Implement server action: create jam (validates, creates jam + admin role)
- [x] **T-202** Build edit jam page (`/jams/[slug]/edit`)
- [x] **T-203** Implement slug uniqueness validation + auto-generation from name
- [x] **T-204** Implement date validation (chronological order enforcement)
- [x] **T-205** Build jam settings section (ranked toggle, dates, theme, visibility toggles)

### Jam Detail & Listing

- [x] **T-210** Build jam detail page (`/jams/[slug]`)
- [x] **T-211** Build jam listing page (`/jams`) with search + status/tag filters
- [x] **T-212** Implement jam status computation from dates (lazy evaluation)
- [x] **T-213** Display appropriate content per status (upcoming info, submissions, results)
- [x] **T-214** Implement "Publish Jam" action (validate required fields, set visibility to
  PUBLIC — transitions DRAFT → UPCOMING)

### Join Jam

- [x] **T-220** Add "Join Jam" button (UPCOMING and ONGOING only)
- [x] **T-221** Implement server action: join jam (create JamParticipant)
- [x] **T-222** Show participant count on jam page

### Submission Settings

- [x] **T-230** Build submission settings section in jam edit (max team size, post-close
  contributors, custom fields)
- [x] **T-231** Implement custom field CRUD (name, description, type, required, private)
- [x] **T-232** Lock custom fields after submission period ends

---

## Phase 3: Jam Permissions

**Depends on: Phase 2**

- [x] **T-300** Build manage jam page (`/jams/[slug]/manage`)
- [x] **T-301** Build role assignment UI (search user, assign Admin/Moderator/Judge/Host)
- [x] **T-302** Implement server action: assign/remove role
- [x] **T-303** Prevent removal of creator's Admin role
- [x] **T-304** Implement permission checking in service layer (reusable `checkJamPermission`)
- [x] **T-305** Gate all jam management actions behind permission checks
- [x] **T-306** Display organizers (admins, mods, judges, hosts) on jam page

---

## Phase 4: Submissions & Teams

**Depends on: Phase 2, Phase 3**

### Create & Edit Submission

- [x] **T-400** Build create submission form (`/jams/[slug]/submissions/new`)
- [x] **T-401** Implement server action: create submission (validates dates, one-per-user check)
- [x] **T-402** Render custom fields in submission form (respecting field types)
- [x] **T-403** Build submission detail page (`/submissions/[id]`)
- [x] **T-404** Build edit submission page (`/submissions/[id]/edit`)
- [x] **T-405** Hide private custom field values from non-organizers/judges
- [x] **T-406** Lock submission editing during RATING and FINISHED statuses

### Submission Listing

- [x] **T-410** Build submission list on jam page (`/jams/[slug]/submissions`)
- [x] **T-411** Respect "hide submissions before end" setting
- [x] **T-412** Show disqualification badge on disqualified submissions _(superseded by T-820)_

### Contributors / Teams

- [x] **T-420** Build invite contributor UI on submission page
- [x] **T-421** Implement server action: add contributor (checks max team size, one-per-jam)
- [x] **T-422** Implement server action: remove contributor
- [x] **T-423** Implement team leader transfer
- [x] **T-424** Lock contributor changes during rating period (with exception per jam setting)

### Submission Moderation

- [x] **T-430** Add disqualify/hide/delete actions for admins and moderators _(reworked in Phase 8)_
- [x] **T-431** Implement server actions: disqualify, hide, delete submission _(reworked in Phase 8)_
- [x] **T-432** Exclude disqualified submissions from ratings _(reworked in Phase 8)_

---

## Phase 5: Rating System (Ranked Jams)

**Depends on: Phase 4**

### Criteria

- [x] **T-500** Build criteria management UI in jam edit (name, description, weight) _(extended in Phase 8: source, primary)_
- [x] **T-501** Implement server action: CRUD criteria

### Rating UI

- [x] **T-510** Build rating page (`/submissions/[id]/rate`) — per-submission rating
- [x] **T-511** Implement rating eligibility check per jam setting
- [x] **T-512** Implement self-rating prevention
- [x] **T-513** Implement server action: submit/update ratings (1-5 per criterion)
- [x] **T-514** Allow updating existing ratings during rating period
- [x] **T-515** Block rating outside of RATING status

### Results Computation

- [x] **T-520** Implement Bayesian average scoring algorithm (per design.md) _(extended in Phase 8: per-criterion + optional/primary overall)_
- [x] **T-521** Implement tiebreaking logic
- [x] **T-522** Store computed results in JamResult table
- [x] **T-523** Build results page (`/jams/[slug]/results`)
- [x] **T-524** Respect "hide results" setting (show only to admins when enabled)
- [x] **T-525** Display per-criterion scores alongside final rank

---

## Phase 6: Homepage & Polish

**Depends on: Phase 5**

- [x] **T-600** Build homepage with featured/upcoming/rating jams
- [x] **T-601** Add responsive design pass (mobile breakpoints)
- [x] **T-602** Build 404 and error pages
- [x] **T-603** Add loading states and skeleton UIs
- [x] **T-604** Sanitize all Markdown rendering — plain-text for now _(replaced by T-880: sanitized GFM)_
- [x] **T-605** Server-side input validation pass (Zod on all server actions)
- [x] **T-606** Add rate limiting middleware on form submissions
- [x] **T-607** Test full jam lifecycle end-to-end (manual browser test: create → join → submit → view)

---

## Phase 7: Deployment

**Depends on: Phase 6**

- [x] **T-700** Finalize Dockerfile (multi-stage build, standalone output)
- [x] **T-701** Finalize docker-compose.yml (app + PostgreSQL)
- [x] **T-702** Document deployment steps in README
- [x] **T-703** Set up production environment variables
- [ ] **T-704** Test deployment on VPS
- [ ] **T-705** Set up database backups

---

## Phase 8: Spec Alignment Refactor

**Brings the prototype in line with the refined spec. Sequenced in
[../plans/refactor-restart.md](../plans/refactor-restart.md).**

### Permissions

- [x] **T-800** Make `JamRole` stackable (`@@unique([jamId, userId, role])`)
- [x] **T-801** Refactor `permissions.ts` to union permissions across a user's roles
- [x] **T-802** Route inline `isAdmin` checks through the permission catalog
- [x] **T-803** Rework role assignment + manage UI for stacked roles

### Submissions

- [x] **T-810** Replace per-platform links with a single itch.io URL + `supportedPlatforms`
- [x] **T-811** Add submission `DRAFT`/`SUBMITTED` status and flow
- [x] **T-812** Implement itch.io code-on-page ownership verification + manual fallback
- [x] **T-813** Fetch safety: single-host allowlist, HTTPS, timeout, size cap
- [x] **T-814** Enforce required custom fields are filled before DRAFT → SUBMITTED
- [x] **T-820** Replace `disqualified`/`hidden` with visible/rateable/competing switches + badges
- [x] **T-821** Wire moderation presets (disqualify, exclude-from-ranking, hide, delete)

### Rating

- [x] **T-830** Add criterion `source` (RATED) + `primary`
- [x] **T-831** Per-criterion ranking + optional/primary overall in scoring
- [x] **T-832** Results: show rank-excluded but rated submissions in a separate "Not competing" section (spec §6.4–6.5)
- [x] **T-833** Results: display each criterion's own ranking, not just per-criterion scores (spec §6.5)

### Platform Administration

- [ ] **T-860** Add `StaffRole` (seeded Site Admin) + permission-based staff checks
- [ ] **T-861** Mandatory TOTP 2FA enrollment + enforcement for staff
- [ ] **T-862** Soft-delete (`deletedAt`) with restore on jams/submissions
- [ ] **T-863** Audit log (`AuditLogEntry`) for staff actions
- [ ] **T-864** Build platform admin page (`/admin`)

### Content

- [ ] **T-880** Sanitized GFM Markdown rendering (escape raw HTML, restrict URL schemes)

### Testing & CI

- [x] **T-890** Vitest unit tests (jam-status, permissions, validations, verification, scoring)
- [x] **T-891** Playwright E2E smoke tests
- [x] **T-892** GitHub Actions CI (typecheck, lint, unit, Postgres-backed E2E)

---

Post-MVP features and unscheduled ideas live in [../backlog.md](../backlog.md).
