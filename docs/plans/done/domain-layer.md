# Domain Layer & Spec-Rule Fixes

Move every rule from [product-spec.md](../../specs/product-spec.md) of the form "who can do what,
in which phase" into a pure, unit-tested `src/domain/` module. Server actions and pages call
these rules instead of re-implementing them inline. The rule violations found in the project
review (listed under *Defects fixed by this plan*) are fixed as part of the move.

Items from the same review that fall outside this plan live in [backlog.md](../../backlog.md).

## Goals

- One source of truth per rule. Rules are pure functions over plain data plus `now`, with no
  Prisma, `auth()` or Next.js imports, so they can be tested exhaustively.
- Server actions become thin: authenticate, load data, call the rule, write.
- Each rule traces to a spec section, and each spec rule is covered by a test.

## Non-goals

- New features beyond the rule functions themselves (leave-jam UI, contributor invites,
  staff 2FA, and so on; see [backlog.md](../../backlog.md)).
- The Cache Components / PPR migration.

## Target shape

```text
src/domain/
  jam-phase.ts        publishedAt + dates + now → DRAFT | UPCOMING | ONGOING | RATING | FINISHED
  participation.ts    canJoin, canLeaveJam, canLeaveSubmission
  submission.ts       canEditSubmission, canSubmit, canUnsubmit, contributorWindow,
                      canManageTeam (leader and contributors have equal rights)
  rating.ts           canRate (eligibility + judges always eligible + own-entry exclusion)
  results.ts          resultsVisibility (organizers vs public, hideResults, revealedAt)
  scoring.ts          pure ranking: ratings + criteria + submissions → ranked results
  *.test.ts           colocated tests, one describe block per spec rule
```

`src/lib/scoring.ts` keeps only the database I/O and delegates the math to
`src/domain/scoring.ts`.

## Defects fixed by this plan

1. Draft/publish: `Jam.status` is never written, any jam with dates is live from creation,
   and publishing sets `visibility: PUBLIC`, which mixes the visibility and lifecycle settings.
2. Results visibility: `hideResults` doesn't hide results after FINISHED, results are public
   during RATING, there is no reveal action, and weight-0 criteria are left out of results.
3. Results require a manual "compute" click, so they can be missing or stale.
4. Rating eligibility: judges can only rate under JUDGES_ONLY or EVERYONE (`rate_as_judge` is
   never checked), and members of DRAFT or deleted submissions count as eligible.
5. `updateSubmissionAction` writes the submission before validating custom fields (partial
   save), and custom-field values can never be cleared.
6. Only the team leader can manage the team, but the spec gives contributors equal rights.
7. Soft-delete filtering is uneven (for example, the contributor "already in a submission" check
   counts deleted submissions, and the jam page links to a deleted submission).
8. Jam create/update form parsing and custom-field validation are each duplicated.

## Checklist

### Schema

- [x] Replace the `Jam.status` enum column with `publishedAt DateTime?`; drop the
      `@@index([status, visibility])` index.
- [x] Add `Jam.resultsRevealedAt DateTime?` (the manual reveal when `hideResults` is on).
- [x] Migration + seed update; regenerate the client.

### Domain module

- [x] `jam-phase.ts`: phase from `publishedAt` + dates (spec §4.4) with tests, including
      boundary instants.
- [x] `participation.ts`: join/leave rules (spec §4.7) with tests; the theme-vote lock is
      stubbed out (Future).
- [x] `submission.ts`: edit / submit / unsubmit windows, contributor add/remove window
      including `allowContributorsAfterClose`, and team-management rights (spec §5) with tests.
- [x] `rating.ts`: eligibility per `ratingEligibility`, judges always eligible, own entry
      excluded, only SUBMITTED + non-deleted memberships count (spec §6.1, §6.3) with tests.
- [x] `results.ts`: visibility matrix (organizer / public × phase × hideResults × revealed)
      (spec §6.5) with tests.
- [x] `scoring.ts`: extract the pure ranking from `lib/scoring.ts`; keep the existing test
      cases and add tests for weight-0 criteria and the no-overall (no primary, no weight) case.

### Wire-up

- [x] Publish action sets `publishedAt` only; visibility stays a separate setting.
      Listings require `publishedAt != null AND visibility = PUBLIC`; direct URLs to drafts
      404 for non-organizers.
- [x] Every action and page that calls `computeJamStatus` switches to the `jam-phase` rules.
- [x] Results: compute on read (no caching needed at jam scale; the `JamResult` table is
      dropped); remove the manual compute button. Add a "reveal results" action for
      `hideResults` jams.
- [x] Results page uses `resultsVisibility` and shows weight-0 criteria.
- [x] Rating action uses `canRate`.
- [x] Submission actions use the `submission.ts` rules; validate everything before any
      write; allow clearing custom-field values (delete the value row).
- [x] Team actions (add/remove contributor, transfer leadership) allow any member, per spec.
- [x] Central soft-delete filtering via a Prisma client extension; remove ad-hoc
      `deletedAt: null` filters where the extension covers them.
- [x] Shared form parsers for jam and submission FormData; one custom-field validator.

### Tests & docs

- [x] Integration test walking one ranked jam through its full lifecycle: create (draft,
      not reachable) → publish → join → submit → verify (manual) → rate → finish → hidden
      results → reveal.
- [x] Update [design.md](../../specs/design.md) and [requirements.md](../../specs/requirements.md)
      for `publishedAt` / `resultsRevealedAt` and the domain layer.
- [x] Update [codebase.md](../../codebase.md) (new `src/domain/` directory, where rules live)
      and [agent/README.md](../../agent/README.md) invariants ("rules live in `src/domain/`;
      actions never re-implement them").
- [x] Update [features.md](../../features.md) and CHANGELOG.
- [x] Peer-review loop until clean.
- [x] Sweep this plan for deferred items, confirm each is in the backlog, then move it to
      `docs/plans/done/` in the final commit.
