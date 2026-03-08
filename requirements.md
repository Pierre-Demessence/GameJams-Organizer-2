---
post_title: "GameJam Organizer 2 — MVP Requirements"
author1: "Pierre"
post_slug: "gamejam-organizer-2-requirements"
summary: "Structured requirements in EARS notation for the MVP of the GameJam Organizer 2 platform."
post_date: 2026-03-08
---

## Overview

This document defines the MVP requirements for the GameJam Organizer 2 platform — a web
application for creating, managing, and participating in game jams. Requirements are written in
[EARS notation](https://en.wikipedia.org/wiki/EARS_%28requirements_engineering%29) and organized
by feature domain.

### MVP Scope Summary

**Included:**

- User accounts (Discord OAuth + email/password + account merging)
- Jam CRUD with full lifecycle (DRAFT → UPCOMING → ONGOING → RATING → FINISHED)
- Ranked and non-ranked jams
- Manual themes (organizer-set, no community voting)
- Submissions with contributors/teams
- Bayesian average rating system with custom criteria
- Filterable jam listing page
- User profiles
- Jam permissions (Admin, Moderator, Judge, Host)

**Deferred to post-MVP:**

- Theme voting
- Notifications (email/in-app)
- Calendar UI (visual)
- Community message board
- Prize system
- Submission verification (code-on-page)
- Late submissions
- Site-wide admin/moderator panel
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

- **Published**: Listed on the public jam listing page.
- **Unlisted**: Accessible only via direct URL.

### REQ-JAM-06: Jam Lifecycle Transitions

The jam status is **computed from dates and visibility** (lazy evaluation):

- `visibility = UNLISTED` and no dates → **DRAFT**
- `visibility = PUBLISHED` and `now < startDate` → **UPCOMING**
- `visibility = UNLISTED` with dates and `now < startDate` → **UPCOMING** (private jam,
  accessible via direct URL only)
- `now ≥ startDate` and `now < endDate` → **ONGOING**
- Ranked: `now ≥ endDate` and `now < ratingEnd` → **RATING**
- Ranked: `now ≥ ratingEnd` → **FINISHED**
- Non-ranked: `now ≥ endDate` → **FINISHED**

Both published and unlisted jams progress through the lifecycle once dates are set.
The "Publish" action (setting visibility to PUBLISHED with valid dates) makes a jam
publicly discoverable; unlisted jams with dates progress identically but are only
accessible via direct URL.

### REQ-JAM-07: Join Jam

WHEN an authenticated user joins a jam that is in UPCOMING or ONGOING status,
THE SYSTEM SHALL add them as a participant.

### REQ-JAM-08: Jam Listing Page

THE SYSTEM SHALL provide a page listing all published jams with filters for:
status (upcoming, ongoing, rating, finished), tags, and a text search on name/description.

### REQ-JAM-09: Jam Detail Page

WHEN a visitor navigates to a jam's page,
THE SYSTEM SHALL display its basic info, settings, current status, organizers, and
(if visible) submissions and results.

---

## REQ-PERM: Jam Permissions

### REQ-PERM-01: Role Assignment

WHEN a jam admin assigns a role to another user,
THE SYSTEM SHALL grant them the corresponding permissions:

- **Admin**: Edit jam, edit/disqualify/delete any submission, manage roles.
- **Moderator**: Edit/disqualify/hide/delete submissions only.
- **Judge**: Rate submissions even without a submission of their own.
- **Host**: Credited on the jam page, no extra permissions.

### REQ-PERM-02: Role Enforcement

THE SYSTEM SHALL enforce role-based access on all jam management actions, denying unauthorized
operations with an appropriate error.

### REQ-PERM-03: Creator Immutability

THE SYSTEM SHALL prevent the jam creator's Admin role from being removed.

---

## REQ-SUB: Submissions & Teams

### REQ-SUB-01: Create Submission

WHEN an authenticated participant creates a submission during the ONGOING period,
THE SYSTEM SHALL create it with the user as the submitter (team leader).

### REQ-SUB-02: Submission Fields

THE SYSTEM SHALL require: title.

THE SYSTEM SHALL accept: description (Markdown), cover image URL, game links (Windows, Mac, Linux,
Web URLs), screenshot URLs, video link URL, and any custom fields defined by the jam organizers.

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

### REQ-SUB-10: Submission Moderation

WHEN a jam admin or moderator disqualifies a submission,
THE SYSTEM SHALL mark it as disqualified, exclude it from ratings and rankings, but keep it
visible on the jam page with a disqualification badge.

### REQ-SUB-11: Submission Deletion

WHEN a jam admin or moderator deletes a submission,
THE SYSTEM SHALL remove it from the jam entirely.

### REQ-SUB-12: Submission Hiding

WHEN a jam admin or moderator hides a submission,
THE SYSTEM SHALL make it invisible on the jam page but retain its data.

### REQ-SUB-13: Submission Edit Window

WHILE a jam is in ONGOING status,
THE SYSTEM SHALL allow submitters and contributors to edit their submission.

WHILE a jam is in RATING or FINISHED status,
THE SYSTEM SHALL prevent submission edits.

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
name, optional description, and optional weight (defaults to 1, can be 0 for non-scoring
criteria).

A ranked jam MUST have at least one criterion with weight > 0. The system SHALL reject
saving criteria configurations where all weights are 0.

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

Final weighted score:

$$\text{FinalScore} = \frac{\sum (WS_c \times w_c)}{\sum w_c}$$

Where $w_c$ = weight of criterion $c$ (only criteria with $w_c > 0$).

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

## Non-Functional Requirements

### REQ-NFR-01: No User Asset Hosting

THE SYSTEM SHALL NOT store user-uploaded files (images, game files). All media must be
referenced via external URLs.

### REQ-NFR-02: Free Platform

THE SYSTEM SHALL be entirely free to use for all users.

### REQ-NFR-03: Responsive Design

THE SYSTEM SHALL provide a responsive UI that works on desktop and mobile browsers.

### REQ-NFR-04: Markdown Sanitization

WHEN rendering user-provided Markdown/HTML,
THE SYSTEM SHALL sanitize output to prevent XSS attacks.

### REQ-NFR-05: Input Validation

THE SYSTEM SHALL validate all user inputs on the server side, rejecting malformed or
excessively long data.

### REQ-NFR-06: CSRF Protection

THE SYSTEM SHALL protect all state-changing endpoints against CSRF attacks.

### REQ-NFR-07: Rate Limiting

THE SYSTEM SHALL enforce rate limiting on authentication endpoints and form submissions.
