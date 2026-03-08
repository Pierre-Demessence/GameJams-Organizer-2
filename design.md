---
post_title: "GameJam Organizer 2 — MVP Technical Design"
author1: "Pierre"
post_slug: "gamejam-organizer-2-design"
summary: "Technical architecture, data models, and implementation design for the GameJam Organizer 2 MVP."
post_date: 2026-03-08
---

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
│  │           Service Layer                    │ │
│  │  (Business logic, validation, auth checks) │ │
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
- **Service Layer** between routes and Prisma to keep business logic testable and separate
  from framework concerns.
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

enum JamStatus {
  DRAFT
  UPCOMING
  ONGOING
  RATING
  FINISHED
}

enum JamVisibility {
  PUBLISHED
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

  status      JamStatus     @default(DRAFT)
  visibility  JamVisibility @default(UNLISTED)

  ranked      Boolean       @default(false)
  startDate   DateTime?
  endDate     DateTime?
  ratingEnd   DateTime?     // Ranked only

  theme           String?
  revealThemeOnStart Boolean @default(false)

  hideResults             Boolean @default(false)
  hideSubmissionsBeforeEnd Boolean @default(false)

  submissionDetails String?  // Shown on submission dialog

  maxTeamSize             Int?
  allowContributorsAfterClose Boolean @default(false)

  ratingEligibility RatingEligibility @default(SUBMITTERS_AND_CONTRIBUTORS)

  createdById String
  createdBy   User      @relation("JamCreator", fields: [createdById], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  roles        JamRole[]
  submissions  Submission[]
  criteria     Criterion[]
  customFields CustomField[]
  participants JamParticipant[]
  results      JamResult[]

  @@index([status, visibility])
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

  @@unique([jamId, userId]) // One role per user per jam (MVP simplification)
}

// ─── Submissions ────────────────────────────────

model Submission {
  id          String  @id @default(cuid())
  jamId       String
  title       String
  description String? // Markdown
  coverUrl    String?

  linkWindows String?
  linkMac     String?
  linkLinux   String?
  linkWeb     String?

  screenshots String[]  // External URLs
  videoUrl    String?

  disqualified Boolean @default(false)
  hidden       Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  jam     Jam                @relation(fields: [jamId], references: [id], onDelete: Cascade)
  members SubmissionMember[]
  ratings Rating[]
  fieldValues CustomFieldValue[]
  results JamResult[]
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

model Criterion {
  id          String  @id @default(cuid())
  jamId       String
  name        String
  description String?
  weight      Float   @default(1)
  sortOrder   Int     @default(0)

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

// ─── Results (computed) ────────────────────────────

model JamResult {
  id           String @id @default(cuid())
  jamId        String
  submissionId String
  rank         Int
  finalScore   Float
  totalRatings Int
  rawAverage   Float
  criteriaScores Json  // { criterionId: { ws, raw, count } }
  computedAt   DateTime @default(now())

  jam        Jam        @relation(fields: [jamId], references: [id], onDelete: Cascade)
  submission Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@unique([jamId, submissionId])
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
│   └── page.tsx                  # Account settings (edit profile, link providers)
└── api/
    └── auth/[...nextauth]/route.ts  # NextAuth handler
```

---

## Rating Computation (Bayesian Average)

### Algorithm

Run once when a ranked jam transitions to FINISHED (or on-demand for admin preview):

```
1. Fetch all ratings for the jam, grouped by submission and criterion.
2. For each criterion c (where weight > 0):
   a. Compute C_c = global mean of all scores on criterion c.
   b. Compute m = median of (number of ratings per submission) across all submissions.
3. For each submission s, for each criterion c:
   a. v = count of ratings for s on c
   b. R_c = mean of ratings for s on c
   c. WS_c = (v × R_c + m × C_c) / (v + m)
4. For each submission s:
   a. FinalScore = Σ(WS_c × w_c) / Σ(w_c)   for all c where w_c > 0
5. Sort submissions by FinalScore DESC.
6. Tiebreak: total ratings DESC → raw average DESC → deterministic random (hash of submission ID).
7. Store computed ranks and scores.
```

### Storage

Computed results are stored in the `JamResult` model (defined in the main Prisma schema above)
to avoid recomputation on every page load.

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

### Implementation — Lazy Status Computation (MVP)

The `status` field in the database is **not manually managed**. It is always **computed on read**
from the persisted dates and visibility. The `status` column in the DB exists only as a
denormalized cache for efficient queries (updated on each read or via a periodic job later).

**Algorithm:**

```
function computeStatus(jam):
  if no dates set → DRAFT
  if now < jam.startDate → UPCOMING
  if now >= jam.startDate and now < jam.endDate → ONGOING
  if jam.ranked and now >= jam.endDate and now < jam.ratingEnd → RATING
  if (jam.ranked and now >= jam.ratingEnd) or (!jam.ranked and now >= jam.endDate) → FINISHED
  fallback → DRAFT
```

Both published and unlisted jams progress through the lifecycle; `visibility` only controls
whether the jam is listed publicly. The **Publish action** sets `visibility = PUBLISHED` with
valid dates, making the jam discoverable on the listing page.

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
| Broken access control| Service layer checks role permissions before every mutation       |

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
