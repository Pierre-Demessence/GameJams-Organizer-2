# GameJam Organizer 2 — MVP Requirements

## Overview

This document defines the MVP requirements for the GameJam Organizer platform — a web
application for creating, managing, and participating in game jams. Requirements are written in
[EARS notation](https://en.wikipedia.org/wiki/EARS_%28requirements_engineering%29) and organized
by feature domain. The authoritative source is [product-spec.md](./product-spec.md); this
document covers only the subset that spec marks `[MVP]`.

### MVP Scope Summary

**Included:**

- User accounts (Discord OAuth + email/password + account merging)
- Jam CRUD with full lifecycle (DRAFT → UPCOMING → ONGOING → RATING → FINISHED)
- Ranked and non-ranked jams
- Manual themes (organizer-set, no community voting)
- Submissions with contributors/teams, DRAFT/SUBMITTED lifecycle
- itch.io ownership verification (code-on-page, mandatory to publish)
- Bayesian average rating system with custom criteria (RATED source, optional primary)
- Submission moderation via independent switches (visible / rateable / competing)
- Filterable jam listing page
- User profiles
- Permission-based jam roles (stackable Admin, Moderator, Judge, Host)
- Minimal platform administration (seeded Site Admin, mandatory 2FA, soft-delete + restore, audit log)

**Deferred to post-MVP:**

- Theme voting
- Notifications (email/in-app)
- Calendar UI (visual)
- Community message board
- Comments on submissions
- Prize system
- Late submissions
- Verified itch.io profile (auto-verify all projects)
- JURY criteria and manual placement
- Rating queue / incentives
- Site Moderator role, sudo-mode step-up, custom-role builder
- Google / GitHub OAuth
- Analytics dashboard

---

## REQ-AUTH: Authentication & Accounts

### REQ-AUTH-01: Discord OAuth Registration

WHEN a visitor clicks "Sign in with Discord,"
THE SYSTEM SHALL authenticate them via Discord OAuth 2.0 and create an account if none exists,
using their Discord username as the default display name and their Discord avatar as their
profile picture URL.

### REQ-AUTH-02: Email/Password Registration

WHEN a visitor submits a registration form with email and password,
THE SYSTEM SHALL create an account after validating the email format and enforcing a minimum
password strength policy (≥ 8 characters, at least one letter and one number).

### REQ-AUTH-03: Login

WHEN a registered user submits valid credentials (email/password or OAuth),
THE SYSTEM SHALL authenticate them and establish a session.

### REQ-AUTH-04: Account Merging

WHEN an authenticated user links an additional OAuth provider (or email/password) from their
account settings,
THE SYSTEM SHALL merge the new provider into their existing account, allowing them to sign in
with either method.

### REQ-AUTH-05: Account Merging — Conflict

IF a user attempts to link a provider already associated with a different account,
THEN THE SYSTEM SHALL reject the link and display an error explaining the conflict.

### REQ-AUTH-06: Session Security

THE SYSTEM SHALL use secure, HttpOnly, SameSite=Strict cookies. When using JWT strategy,
a new token SHALL be issued on each login.

### REQ-AUTH-07: Logout

WHEN an authenticated user clicks "Sign out,"
THE SYSTEM SHALL terminate their session and redirect them to the homepage.

### REQ-AUTH-08: Password Reset (Deferred)

> **Deferred to post-MVP.** For MVP, users who forget their email/password can link an OAuth
> provider from the sign-in page as a recovery path. A proper email-based reset flow will be
> added later.

---

## REQ-PROFILE: User Profiles

### REQ-PROFILE-01: Profile Fields

THE SYSTEM SHALL store and display the following profile fields for each user:
username (unique), display name, bio (text), and profile picture URL (external).

### REQ-PROFILE-02: Profile Page

WHEN a visitor navigates to a user's profile page,
THE SYSTEM SHALL display their profile information, a list of jams they created or participated
in, and a list of their submissions.

### REQ-PROFILE-03: Edit Profile

WHEN an authenticated user edits their profile,
THE SYSTEM SHALL validate inputs (username uniqueness, URL format for profile picture) and
persist changes.

---

## REQ-JAM: Game Jam Management

### REQ-JAM-01: Create Jam

WHEN an authenticated user creates a new jam,
THE SYSTEM SHALL create it in DRAFT status with the creator as the Jam Admin.

### REQ-JAM-02: Jam Basic Info

THE SYSTEM SHALL require the following fields when creating/editing a jam:
name, short description, vanity URL (slug, unique), and full description (Markdown).

THE SYSTEM SHALL accept the following optional fields:
cover image URL, submission details text, social media hashtag, and tags.

Slugs must be 3–60 characters, lowercase alphanumeric and hyphens only, no leading/trailing
hyphens (pattern: `^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$`).

### REQ-JAM-03: Jam Settings

THE SYSTEM SHALL allow jam admins to configure:

- Ranked or non-ranked
- Start date/time
- End date/time (for non-ranked: end of jam; for ranked: end of submissions / start of rating)
- End of rating period date/time (ranked only)
- Optional theme (text, with "reveal on start" toggle)
- Hide results toggle (ranked only)
- Hide submissions before end toggle

### REQ-JAM-04: Date Validation

IF a jam admin sets dates that violate chronological order (start ≥ end, or end ≥ rating end),
THEN THE SYSTEM SHALL reject the change and display a validation error.

### REQ-JAM-05: Jam Visibility

THE SYSTEM SHALL support two visibility modes:

- **Public**: Listed on the public jam listing page.
- **Unlisted**: Accessible only via direct URL.

### REQ-JAM-06: Jam Lifecycle Transitions

The jam status is **computed from dates only** (lazy evaluation):

- No `startDate` or `endDate` → **DRAFT**
- `now < startDate` → **UPCOMING**
- `now ≥ startDate` and `now < endDate` → **ONGOING**
- Ranked: `now ≥ endDate` and `now < ratingEnd` → **RATING**
- Ranked: `now ≥ ratingEnd` → **FINISHED**
- Non-ranked: `now ≥ endDate` → **FINISHED**

Visibility (PUBLIC vs UNLISTED) is independent of status and controls listing
visibility only. Both public and unlisted jams progress through the lifecycle
identically once dates are set. The "Publish" action sets visibility to PUBLIC
with valid dates, making the jam discoverable on listings; unlisted jams with
dates progress the same way but are only accessible via direct URL.

### REQ-JAM-07: Join Jam

WHEN an authenticated user joins a jam that is in UPCOMING or ONGOING status,
THE SYSTEM SHALL add them as a participant.

### REQ-JAM-08: Jam Listing Page

THE SYSTEM SHALL provide a page listing all public jams with filters for:
status (upcoming, ongoing, rating, finished), tags, and a text search on name/description.

### REQ-JAM-09: Jam Detail Page

WHEN a visitor navigates to a jam's page,
THE SYSTEM SHALL display its basic info, settings, current status, organizers, and
(if visible) submissions and results.

---

## REQ-PERM: Jam Permissions

Access is **permission-based**: a hardcoded catalog of jam permissions is enforced in code, and
the named roles below are seeded bundles of those permissions. Roles are **stackable** — a user
may hold several at once, and their effective powers are the union of their roles' permissions.

### REQ-PERM-01: Permission Catalog

THE SYSTEM SHALL enforce each sensitive jam action against a specific permission from a hardcoded
catalog (edit jam, manage roles, edit submission, moderate submission, delete submission, rate as
judge), never against a role name directly.

### REQ-PERM-02: Seeded Role Bundles

THE SYSTEM SHALL provide the following roles as named bundles of permissions:

- **Admin**: every jam permission — edit the jam and any submission, and manage roles.
- **Moderator**: moderate submissions (edit, disqualify, exclude from ranking, hide, delete), but
  not edit the jam or manage roles.
- **Judge**: rate submissions even without a submission of their own.
- **Host**: a credit only, with no permissions.

### REQ-PERM-03: Stackable Roles

WHEN a jam admin assigns roles to a user,
THE SYSTEM SHALL allow multiple roles per user and grant the union of their permissions.

### REQ-PERM-04: Role Enforcement

THE SYSTEM SHALL check the required permission before every jam management action, denying
unauthorized operations with an appropriate error.

### REQ-PERM-05: Creator Immutability

THE SYSTEM SHALL treat the jam creator as a permanent Admin and prevent that role from being removed.

---

## REQ-SUB: Submissions & Teams

### REQ-SUB-01: Create Submission

WHEN an authenticated participant creates a submission during the ONGOING period,
THE SYSTEM SHALL create it with the user as the submitter (team leader).

### REQ-SUB-02: Submission Fields

THE SYSTEM SHALL require: title and a single itch.io project URL (validated against the itch.io
URL pattern).

THE SYSTEM SHALL accept: description (Markdown), cover image URL, supported platforms (a
multi-select of Windows, Mac, Linux, Web), screenshot URLs, video link URL, and any custom fields
defined by the jam organizers.

### REQ-SUB-03: Custom Submission Fields

THE SYSTEM SHALL allow jam admins to define custom submission fields, each with:
name, description, type (single-line, multi-line, URL), required/optional flag, and
public/private flag. Private fields are visible only to organizers and judges.

### REQ-SUB-04: Custom Field Lock

IF the submission period is over,
THEN THE SYSTEM SHALL prevent jam admins from modifying custom submission field definitions.

### REQ-SUB-05: One Submission Per Jam

THE SYSTEM SHALL prevent a user from being part of more than one submission per jam.

### REQ-SUB-06: Contributors

WHEN a team leader invites another jam participant to their submission,
THE SYSTEM SHALL add them as a contributor with the same edit permissions as the team leader.

### REQ-SUB-07: Max Team Size

IF a jam has a max team size configured and the team already has that many members,
THEN THE SYSTEM SHALL reject additional contributor invitations.

### REQ-SUB-08: Team Leader Transfer

WHEN a team leader transfers leadership to a contributor,
THE SYSTEM SHALL update the team leader role accordingly.

### REQ-SUB-09: Contributor Lock During Rating

WHILE a jam is in RATING status,
THE SYSTEM SHALL prevent adding or removing contributors from submissions,
UNLESS the jam setting "allow contributors after submissions close" is enabled,
in which case contributors may be added but not removed.

### REQ-SUB-10: Moderation Switches

THE SYSTEM SHALL express submission moderation through three independent switches — **visible**
(appears on the jam page), **rateable** (can receive ratings), and **competing** (counts in the
ranking) — so moderation states compose cleanly.

### REQ-SUB-11: Moderation Presets

WHEN a jam admin or moderator moderates a submission,
THE SYSTEM SHALL offer these presets over the switches:

- **Disqualify** — visible, but rank-excluded and rating-disabled; shown with a "Disqualified"
  badge and reason.
- **Exclude from ranking** — visible and still rateable, but rank-excluded; shown with a
  "Not competing" badge.
- **Hide** — removed from the jam page, data retained.

### REQ-SUB-12: Submission Deletion

WHEN a jam admin or moderator deletes a submission,
THE SYSTEM SHALL remove it from the jam entirely.

### REQ-SUB-13: Submission Edit Window

WHILE a jam is in ONGOING status,
THE SYSTEM SHALL allow submitters and contributors to edit their submission.

WHILE a jam is in RATING or FINISHED status,
THE SYSTEM SHALL prevent submission edits.

---

## REQ-VERIFY: Submission Lifecycle & Ownership Verification

### REQ-VERIFY-01: Submission Status

THE SYSTEM SHALL give every submission a status of **DRAFT** (being prepared; visible only to the
team and organizers; not rateable) or **SUBMITTED** (ownership-verified and required fields
complete; publicly visible subject to jam settings, and rateable once rating opens).

### REQ-VERIFY-02: Verification Required to Publish

THE SYSTEM SHALL keep a submission in DRAFT until its itch.io project link is verified and required
fields are filled; only then MAY it move to SUBMITTED, and only before the submission deadline.

### REQ-VERIFY-03: Code-on-Page Verification

WHEN a team requests verification,
THE SYSTEM SHALL issue a unique code bound to the submission and its itch.io URL, and upon a
"verify" action fetch the itch.io project page and confirm the code is present.

### REQ-VERIFY-04: Manual Fallback

IF automated verification cannot succeed,
THEN THE SYSTEM SHALL allow a Jam Admin or Jam Moderator to mark the submission verified manually.

### REQ-VERIFY-05: Re-verification on Link Change

IF a verified submission's itch.io link is changed,
THEN THE SYSTEM SHALL return it to DRAFT until it is re-verified.

### REQ-VERIFY-06: Fetch Safety

THE SYSTEM SHALL fetch only `itch.io` and `*.itch.io` URLs over HTTPS (a single-host allowlist),
with a request timeout and a response-size cap.

---

## REQ-RATING: Rating System (Ranked Jams Only)

### REQ-RATING-01: Rating Eligibility

THE SYSTEM SHALL restrict who can rate based on the jam's "who can rate" setting:

- **Submitters only**: Only team leaders can rate.
- **Submitters and contributors**: All team members can rate.
- **Judges**: Only users with the Judge role can rate.
- **Everyone**: Any authenticated user can rate.

### REQ-RATING-02: Self-Rating Prevention

THE SYSTEM SHALL prevent users from rating their own submission (any submission they are part of).

### REQ-RATING-03: Rating Scale

WHEN an eligible user rates a submission,
THE SYSTEM SHALL present each criterion and accept a score from 1 to 5 (integer) for each.

### REQ-RATING-04: Rating Anonymity

THE SYSTEM SHALL keep all ratings anonymous — neither submitters nor the public can see who
rated what.

### REQ-RATING-05: Rating Period

WHILE a ranked jam is in RATING status,
THE SYSTEM SHALL allow eligible users to submit and update ratings.

WHILE a ranked jam is NOT in RATING status,
THE SYSTEM SHALL prevent any rating submissions.

### REQ-RATING-06: Criteria Definition

THE SYSTEM SHALL allow jam admins to define rating criteria, each with:
name, optional description, optional weight (defaults to 1, can be 0 to collect a criterion
without contributing to the averaged overall), a **source** (for the MVP always RATED — ranked
from aggregated ratings), and an optional **primary** flag marking the one criterion that
determines the overall ranking (with a single criterion, it is primary by default).

A ranked jam MUST have at least one criterion. WHERE the overall ranking is computed by averaging
(no primary set), at least one RATED criterion MUST have a non-zero weight.

### REQ-RATING-07: Bayesian Average Scoring

WHEN the rating period ends,
THE SYSTEM SHALL compute scores using Bayesian averaging:

For each criterion with weight > 0:

$$WS_c = \frac{v \times R_c + m \times C_c}{v + m}$$

Where:

- $v$ = number of ratings for this submission on criterion $c$
- $R_c$ = arithmetic mean of ratings for this submission on criterion $c$
- $m$ = tuning parameter (median number of ratings across all submissions)
- $C_c$ = global mean rating for criterion $c$ across all submissions

Each RATED criterion produces its own ranking from its weighted score $WS_c$.

The **overall** ranking is optional:

- **Primary set** — the overall equals that criterion's ranking.
- **No primary** — the overall is the weighted average of the RATED criteria's weighted scores:

$$\text{FinalScore} = \frac{\sum (WS_c \times w_c)}{\sum w_c}$$

  where $w_c$ = weight of criterion $c$ (only criteria with $w_c > 0$).

### REQ-RATING-08: Tiebreaking

IN CASE OF a tie in FinalScore,
THE SYSTEM SHALL rank by:

1. Higher total number of ratings received.
2. Higher raw average score (simple arithmetic mean, no Bayesian adjustment).
3. Random (deterministic seed for reproducibility).

### REQ-RATING-09: Results Display

WHEN a ranked jam reaches FINISHED status and "hide results" is not enabled,
THE SYSTEM SHALL display the rankings publicly, showing each submission's final score, rank,
and per-criterion scores.

### REQ-RATING-10: Hidden Results

WHILE "hide results" is enabled on a ranked jam,
THE SYSTEM SHALL hide rankings from the public, showing only to jam admins.

---

## REQ-SUB-SETTINGS: Submission Settings

### REQ-SUB-SETTINGS-01: Configurable Options

THE SYSTEM SHALL allow jam admins to configure:

- Max team size (optional; no limit if unset)
- Allow adding contributors after submissions close (boolean)
- Custom submission fields (see REQ-SUB-03)

---

## REQ-ADMIN: Platform Administration

### REQ-ADMIN-01: Permission-Based Staff Access

THE SYSTEM SHALL enforce staff actions against specific platform permissions from a hardcoded
catalog (edit/delete any jam, remove/hide/restore any submission, suspend/ban/delete accounts,
manage staff, view audit log), never against a title directly.

### REQ-ADMIN-02: Seeded Site Admin

THE SYSTEM SHALL seed a single **Site Admin** role holding every platform permission.

### REQ-ADMIN-03: Mandatory Two-Factor Authentication

THE SYSTEM SHALL require every staff member to enrol a TOTP authenticator app, independently of
how they sign in (including OAuth).

### REQ-ADMIN-04: Soft Delete With Restore

WHEN a staff member removes content,
THE SYSTEM SHALL soft-delete it (mark deleted, retain data) so another admin can restore it.

### REQ-ADMIN-05: Audit Log

THE SYSTEM SHALL record every staff action — who did it, what, and when — for investigation and
reversal.

---

## Non-Functional Requirements

### REQ-NFR-01: No User Asset Hosting

THE SYSTEM SHALL NOT store user-uploaded files (images, game files). All media must be
referenced via external URLs.

### REQ-NFR-02: Free Platform

THE SYSTEM SHALL be entirely free to use for all users.

### REQ-NFR-03: Responsive Design

THE SYSTEM SHALL provide a responsive UI that works on desktop and mobile browsers.

### REQ-NFR-04: Markdown Sanitization

THE SYSTEM SHALL render all description fields as sanitized GitHub-Flavored Markdown: raw HTML is
escaped rather than rendered, and link/image URLs are restricted to `http`, `https`, and `mailto`
schemes (no scripts, iframes, inline event handlers, or inline styles).

### REQ-NFR-05: Input Validation

THE SYSTEM SHALL validate all user inputs on the server side, rejecting malformed or
excessively long data.

### REQ-NFR-06: CSRF Protection

THE SYSTEM SHALL protect all state-changing endpoints against CSRF attacks.

### REQ-NFR-07: Rate Limiting

THE SYSTEM SHALL enforce rate limiting on authentication endpoints and form submissions.
