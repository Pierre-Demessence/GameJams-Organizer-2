# GameJam Organizer 2 — MVP Technical Design

The authoritative product source is [product-spec.md](./product-spec.md); this document covers the
technical design of the MVP subset, and [requirements.md](./requirements.md) holds the EARS
requirements. The data model below is the **target** schema the implementation converges on.

## Tech Stack

| Layer         | Choice                          | Rationale                                           |
| ------------- | ------------------------------- | --------------------------------------------------- |
| Framework     | Next.js (App Router)            | SSR + API routes in one project, React ecosystem    |
| Language      | TypeScript                      | Type safety across full stack                       |
| Database      | PostgreSQL                      | Relational integrity for jams/submissions/ratings   |
| ORM           | Prisma                          | Type-safe queries, migrations, schema-first         |
| Auth          | NextAuth.js (Auth.js v5)        | Built-in Discord + Credentials providers            |
| UI            | shadcn/ui + Tailwind CSS        | Accessible components, fast to build, customizable  |
| Validation    | Zod                             | Runtime + type-level schema validation              |
| Markdown      | react-markdown + rehype-sanitize | Render user Markdown with XSS protection           |
| Deployment    | Docker (self-hosted VPS)        | Cost-effective, full control                        |

---

## Architecture Overview

```
┌────────────────────────────────────────────────┐
│                    Browser                     │
│  Next.js App (React + shadcn/ui + Tailwind)    │
└──────────────────┬─────────────────────────────┘
                   │ HTTPS
┌──────────────────▼─────────────────────────────┐
│              Next.js Server                     │
│  ┌─────────────┐  ┌──────────────────────────┐ │
│  │ App Router  │  │ Server Actions / API      │ │
│  │ (Pages/SSR) │  │ Routes (/api/...)         │ │
│  └─────────────┘  └──────────┬───────────────┘ │
│                              │                  │
│  ┌───────────────────────────▼───────────────┐ │
│  │  Domain rules (src/domain, pure)          │ │
│  │  + I/O helpers (src/lib: db, auth, ...)   │ │
│  └───────────────────────────┬───────────────┘ │
│                              │                  │
│  ┌───────────────────────────▼───────────────┐ │
│  │         Prisma Client (ORM)               │ │
│  └───────────────────────────┬───────────────┘ │
└──────────────────────────────┼─────────────────┘
                               │
┌──────────────────────────────▼─────────────────┐
│              PostgreSQL Database                │
└────────────────────────────────────────────────┘
```

### Key Architectural Decisions

- **Server Actions** for form mutations (create jam, submit rating) — colocated with forms,
  type-safe, CSRF-protected by default in Next.js.
- **API Routes** (`/api/...`) only where external access or webhooks are needed.
- **Domain layer** (`src/domain/`): every spec rule of the form "who can do what, in which
  phase" is a pure function over plain data plus `now`, returning a `Decision`
  (`{ allowed: true }` or `{ allowed: false, reason }`). Actions and pages load data, call the
  rule, and act on the decision; they never re-implement a rule inline.
- **Soft delete** is enforced by a Prisma client extension (`src/lib/db.ts`): top-level reads of
  `Jam` and `Submission` only see rows with `deletedAt = null`, unless the query names
  `deletedAt` itself. Relation filters, includes and `_count` are not covered and filter
  explicitly.
- **No external file storage** — all media referenced by URL.

---

## Authentication Flow

```
User clicks "Sign in with Discord"
  → NextAuth Discord provider → Discord OAuth consent
  → Callback: upsert User + link Account
  → Session cookie set (JWT strategy)

User signs in with Email/Password
  → NextAuth Credentials provider
  → Verify bcrypt hash
  → Session cookie set

User links additional provider (account merging)
  → Settings page → "Link Discord" / "Link Email"
  → NextAuth links new Account record to existing User
  → Conflict check: if provider already linked to another user → error
```

### Auth.js Configuration Notes

- Use **JWT session strategy** (stateless, no session table needed).
- Custom `signIn` callback to handle account merging conflicts.
- `pages` config for custom sign-in/sign-up pages.
- **Staff 2FA:** every staff member must enrol a TOTP authenticator (`TotpCredential`), enforced
  independently of their sign-in provider before any staff action.

---

## Data Model (Prisma Schema)

```prisma
// ─── Auth ───────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  email         String?   @unique
  emailVerified DateTime?
  passwordHash  String?
  username      String    @unique
  displayName   String?
  bio           String?
  avatarUrl     String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts        Account[]
  createdJams     Jam[]              @relation("JamCreator")
  jamRoles        JamRole[]
  jamParticipants JamParticipant[]
  submissions     SubmissionMember[]
  ratings         Rating[]
  staffRoles      StaffRole[]
  totpCredential  TotpCredential?
  auditEntries    AuditLogEntry[]    @relation("AuditActor")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

// NOTE: No Session model — using JWT strategy (stateless).

// ─── Jams ───────────────────────────────────────

enum JamVisibility {
  PUBLIC
  UNLISTED
}

enum RatingEligibility {
  SUBMITTERS_ONLY
  SUBMITTERS_AND_CONTRIBUTORS
  JUDGES_ONLY
  EVERYONE
}

model Jam {
  id          String        @id @default(cuid())
  name        String
  slug        String        @unique
  shortDesc   String
  fullDesc    String        // Markdown
  coverUrl    String?
  hashtag     String?
  tags        String[]      // PostgreSQL array

  publishedAt DateTime?     // Null while a draft; phase is derived from dates once set
  visibility  JamVisibility @default(UNLISTED)

  ranked      Boolean       @default(false)
  startDate   DateTime?
  endDate     DateTime?
  ratingEnd   DateTime?     // Ranked only

  theme           String?
  revealThemeOnStart Boolean @default(true)

  hideResults             Boolean @default(false)
  resultsRevealedAt       DateTime? // Manual reveal while hideResults is on
  hideSubmissionsBeforeEnd Boolean @default(false)

  submissionDetails String?  // Shown on submission dialog

  maxTeamSize             Int?
  allowContributorsAfterClose Boolean @default(false)

  ratingEligibility RatingEligibility @default(SUBMITTERS_AND_CONTRIBUTORS)

  createdById String
  createdBy   User      @relation("JamCreator", fields: [createdById], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime? // Soft delete (staff)

  roles        JamRole[]
  submissions  Submission[]
  criteria     Criterion[]
  customFields CustomField[]
  participants JamParticipant[]

  @@index([visibility, publishedAt])
  @@index([createdAt])
}

model JamParticipant {
  id     String @id @default(cuid())
  jamId  String
  userId String

  jam  Jam  @relation(fields: [jamId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([jamId, userId])
}

// ─── Jam Permissions ────────────────────────────

enum JamRoleType {
  ADMIN
  MODERATOR
  JUDGE
  HOST
}

model JamRole {
  id     String      @id @default(cuid())
  jamId  String
  userId String
  role   JamRoleType

  jam  Jam  @relation(fields: [jamId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([jamId, userId, role]) // Stackable: a user may hold several roles per jam
}

// ─── Submissions ────────────────────────────────

enum SubmissionStatus {
  DRAFT
  SUBMITTED
}

enum Platform {
  WINDOWS
  MAC
  LINUX
  WEB
}

model Submission {
  id          String            @id @default(cuid())
  jamId       String
  title       String
  description String?           // Markdown
  coverUrl    String?

  itchUrl            String?    // Single itch.io project URL
  supportedPlatforms Platform[] // Windows / Mac / Linux / Web

  screenshots String[]          // External URLs
  videoUrl    String?

  status SubmissionStatus @default(DRAFT)

  // Ownership verification (itch.io code-on-page)
  verificationCode String?
  verified         Boolean   @default(false)
  verifiedAt       DateTime?
  verifiedManually Boolean   @default(false)

  // Moderation switches (compose independently)
  visible          Boolean @default(true)
  rateable         Boolean @default(true)
  competing        Boolean @default(true)
  moderationReason String?

  deletedAt DateTime? // Soft delete (staff)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  jam         Jam                @relation(fields: [jamId], references: [id], onDelete: Cascade)
  members     SubmissionMember[]
  ratings     Rating[]
  fieldValues CustomFieldValue[]
}

model SubmissionMember {
  id           String  @id @default(cuid())
  submissionId String
  userId       String
  isLeader     Boolean @default(false)

  submission Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([submissionId, userId])
}

// ─── Custom Fields ──────────────────────────────

enum FieldType {
  SINGLE_LINE
  MULTI_LINE
  URL
}

model CustomField {
  id          String    @id @default(cuid())
  jamId       String
  name        String
  description String?
  type        FieldType @default(SINGLE_LINE)
  required    Boolean   @default(false)
  isPrivate   Boolean   @default(false)
  sortOrder   Int       @default(0)

  jam    Jam              @relation(fields: [jamId], references: [id], onDelete: Cascade)
  values CustomFieldValue[]

  @@index([jamId])
}

model CustomFieldValue {
  id           String @id @default(cuid())
  fieldId      String
  submissionId String
  value        String

  field      CustomField @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  submission Submission  @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@unique([fieldId, submissionId])
}

// ─── Rating ─────────────────────────────────────

enum CriterionSource {
  RATED  // Ranked from aggregated ratings (MVP)
  JURY   // Manually placed by admins/judges (Future)
}

model Criterion {
  id          String          @id @default(cuid())
  jamId       String
  name        String
  description String?
  weight      Float           @default(1)
  source      CriterionSource @default(RATED)
  isPrimary   Boolean         @default(false)
  sortOrder   Int             @default(0)

  jam     Jam      @relation(fields: [jamId], references: [id], onDelete: Cascade)
  ratings Rating[]
}

model Rating {
  id           String @id @default(cuid())
  submissionId String
  criterionId  String
  userId       String
  score        Int    // 1-5

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  submission Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  criterion  Criterion  @relation(fields: [criterionId], references: [id], onDelete: Cascade)
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([submissionId, criterionId, userId])
  @@index([submissionId])
}

// ─── Platform Administration ────────────────────

enum StaffRoleType {
  SITE_ADMIN
}

model StaffRole {
  id     String        @id @default(cuid())
  userId String
  role   StaffRoleType

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, role])
}

model TotpCredential {
  id         String   @id @default(cuid())
  userId     String   @unique
  secret     String
  enrolledAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model AuditLogEntry {
  id         String   @id @default(cuid())
  actorId    String
  action     String
  targetType String
  targetId   String?
  metadata   Json?
  createdAt  DateTime @default(now())

  actor User @relation("AuditActor", fields: [actorId], references: [id])

  @@index([createdAt])
}
```

---

## Page Structure (App Router)

```
app/
├── layout.tsx                    # Root layout (nav, footer, providers)
├── page.tsx                      # Homepage (featured jams, call to action)
├── (auth)/
│   ├── sign-in/page.tsx          # Sign in (Discord + Email)
│   └── sign-up/page.tsx          # Register with email
├── jams/
│   ├── page.tsx                  # Jam listing with filters
│   ├── new/page.tsx              # Create jam form (authenticated)
│   └── [slug]/
│       ├── page.tsx              # Jam detail page
│       ├── edit/page.tsx         # Edit jam (admin only)
│       ├── submissions/
│       │   ├── page.tsx          # Submission list
│       │   └── new/page.tsx      # Create submission
│       ├── submit/page.tsx       # Alias → submissions/new
│       ├── rate/page.tsx         # Rate submissions (during rating period)
│       ├── results/page.tsx      # Rankings (after rating period)
│       └── manage/
│           ├── page.tsx          # Manage jam (roles, submissions)
│           └── roles/page.tsx    # Assign roles
├── submissions/
│   └── [id]/
│       ├── page.tsx              # Submission detail
│       └── edit/page.tsx         # Edit submission
├── users/
│   └── [username]/page.tsx       # User profile
├── settings/
│   └── page.tsx                  # Account settings (edit profile, link providers, 2FA enrollment)
├── admin/
│   └── page.tsx                  # Platform admin (audit log, moderation) — Site Admin only
└── api/
    └── auth/[...nextauth]/route.ts  # NextAuth handler
```

---

## Rating Computation (Bayesian Average)

### Algorithm

Run once when a ranked jam transitions to FINISHED (or on-demand for admin preview):

```
1. Fetch all ratings for the jam, grouped by submission and criterion. Rank only competing,
   rateable submissions; rank-excluded ones are shown separately, not ranked.
2. For each RATED criterion c:
   a. C_c = global mean of all scores on criterion c.
   b. m = median of (number of ratings per submission) across all submissions.
   c. For each submission s: v = count, R_c = mean, WS_c = (v × R_c + m × C_c) / (v + m).
   d. Rank submissions on c by WS_c (the per-criterion ranking).
3. Overall ranking (optional):
   a. Primary criterion set → overall = that criterion's ranking.
   b. Else → FinalScore = Σ(WS_c × w_c) / Σ(w_c) over RATED criteria with w_c > 0; rank by it.
   c. No primary and no RATED criteria → no overall ranking (per-criterion results only).
4. Tiebreak: total ratings DESC → raw average DESC → deterministic random (hash of submission ID).
   Per-criterion rankings use the same tiebreak on that criterion's count and raw mean.
```

> For the MVP all criteria are RATED; JURY criteria and manual placement are Future.

### Computation on read

Results are not stored. `rankSubmissions` (`src/domain/scoring.ts`) is a pure function of the
jam's criteria, SUBMITTED submissions and ratings; `loadJamResults` (`src/lib/scoring.ts`) loads
those rows and calls it. Results are therefore never stale and need no organizer action.

### Visibility

`resultsAccess` (`src/domain/results.ts`) decides who sees results:

| Viewer | RATING | FINISHED, not hidden | FINISHED, hidden | FINISHED, hidden + revealed |
| --- | --- | --- | --- | --- |
| Public | none | public | none | public |
| Holder of `preview_results` (Admin, Moderator) | preview | public | preview | public |

A Jam Admin reveals hidden results once the jam is FINISHED, which sets `resultsRevealedAt`.

---

## Jam Lifecycle — State Machine

```
         publish
  DRAFT ──────────► UPCOMING
                       │
               start date reached
                       │
                       ▼
                    ONGOING
                       │
              end date reached
                       │
            ┌──────────┼──────────┐
            │ (non-ranked)        │ (ranked)
            ▼                     ▼
         FINISHED              RATING
                                  │
                        rating end reached
                                  │
                                  ▼
                              FINISHED
```

### Implementation — Derived Phase

The phase is never stored. `jamPhase` (`src/domain/jam-phase.ts`) derives it on read:

```
function jamPhase(jam, now):
  if jam.publishedAt is null or dates are missing → DRAFT
  if now < jam.startDate → UPCOMING
  if now < jam.endDate → ONGOING
  if jam.ranked and now < jam.ratingEnd → RATING
  → FINISHED
```

**Publish** (`canPublish`) sets `publishedAt`. It requires complete, ordered dates (and a rating
end for ranked jams) and, for ranked jams, at least one criterion plus a primary criterion or a
RATED criterion with non-zero weight. Once published, a jam must keep a complete schedule.

`visibility` is independent of the lifecycle: listings show jams that are published **and**
PUBLIC; an UNLISTED published jam runs its full lifecycle and is reachable by URL only.

---

## Security Considerations

| Concern              | Mitigation                                                        |
| -------------------- | ----------------------------------------------------------------- |
| XSS in Markdown      | rehype-sanitize strips dangerous HTML                             |
| CSRF                 | Next.js Server Actions have built-in CSRF tokens                  |
| SQL Injection        | Prisma uses parameterized queries exclusively                     |
| Auth bypass          | Middleware checks session on protected routes                     |
| Rate limiting        | Rate limiter middleware on auth + form endpoints                  |
| Password storage     | bcrypt with cost factor ≥ 12                                     |
| Session fixation     | New JWT issued on each login (NextAuth default)                  |
| Broken access control| Permission-catalog check before every mutation (jam + platform)   |
| SSRF (itch.io fetch) | Single-host allowlist (`itch.io`, `*.itch.io`), HTTPS, timeout, size cap |
| Staff account takeover| Mandatory TOTP 2FA for all staff; soft-delete + audit log limit blast radius |

---

## Error Handling Strategy

- **Validation errors**: Zod schemas on all inputs; return structured errors to the client.
- **Auth errors**: Redirect to sign-in with flash message.
- **Not found**: Custom 404 page.
- **Permission denied**: 403 page with explanation.
- **Server errors**: Generic 500 page; log full error server-side.

---

## Deployment (Docker)

```dockerfile
# Multi-stage build
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Docker Compose with PostgreSQL:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      DISCORD_CLIENT_ID: ${DISCORD_CLIENT_ID}
      DISCORD_CLIENT_SECRET: ${DISCORD_CLIENT_SECRET}
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}

volumes:
  pgdata:
```
