# Plan: Team and participation (MVP)

Status: implemented and verified (lint, unit, integration, build, browser); peer review done (no blocking findings). Delete this plan in the feature's final commit.

## Goal

Let users leave a jam and leave a submission (spec §4.7), and replace direct contributor adds
with invites the invitee must accept (spec §5, "Contributor change window").

## Acceptance criteria

- WHEN a Joined user who is not in a live submission leaves a jam, THE SYSTEM SHALL remove their
  `JamParticipant` row and their pending invites in that jam.
- IF a user in a live submission tries to leave the jam, THEN THE SYSTEM SHALL refuse with the
  `canLeaveJam` reason, and the jam page SHALL show that reason instead of a Leave button.
- WHEN a non-leader member leaves a submission while the jam is ONGOING, THE SYSTEM SHALL remove
  their membership and keep them Joined.
- IF the leader, or anyone outside ONGOING, tries to leave a submission, THEN THE SYSTEM SHALL
  refuse with the `canLeaveSubmission` reason.
- WHEN a member invites a username, THE SYSTEM SHALL create a pending invite only if the
  contributor window is open, the invitee has joined the jam, is in no live submission in it, has
  no pending invite to this submission, and members + pending invites < `maxTeamSize`.
- WHEN the invitee accepts, THE SYSTEM SHALL re-check the window, joined state, single-submission
  rule and `maxTeamSize` (members only), add them as a non-leader member, and delete all their
  pending invites in that jam, in one transaction.
- WHEN the invitee declines, or any member cancels, THE SYSTEM SHALL delete the invite.
- WHILE the contributor window is closed or the submission is deleted, THE SYSTEM SHALL hide its
  invites and refuse to accept them.
- WHEN a user creates their own submission, THE SYSTEM SHALL delete their pending invites in
  that jam.
- THE SYSTEM SHALL rate-limit every action in this plan, including the existing remove and
  transfer actions, which currently are not.

## Design

- **Data**: new `SubmissionInvite` (`submissionId`, `inviteeId`, `invitedById`, `createdAt`;
  unique `[submissionId, inviteeId]`; cascade on submission and users). Pending only: accept,
  decline and cancel delete the row, so there is no status column. SQL migration via
  `pnpm db:migrate`; new table only, existing members stay as they are.
- **Rules** (`src/domain/submission.ts`): `canInviteContributor` replaces `canAddContributor`
  (same window logic, team size counts pending invites); `canAcceptInvite` (window, joined, not in
  a live submission, team not full). `canLeaveJam` / `canLeaveSubmission` already exist. The
  window check is shared by both rules, not duplicated.
- **Actions** (`src/app/submissions/actions.ts`): `inviteContributorAction` replaces
  `addContributorAction`; add `cancelInviteAction`, `acceptInviteAction`, `declineInviteAction`,
  `leaveSubmissionAction`. `src/app/jams/actions.ts`: `leaveJamAction`. Invite reads filter the
  submission with `deletedAt: null` (relation filters bypass the soft-delete extension).
- **Loaders**: the submission page / editor loads pending invites for `TeamManager`; the jam page
  loader loads the viewer's pending invites (submission title, inviter) while the window is open.
- **UI**:
  - `TeamManager`: the add form becomes "Invite", pending invites listed under members with a
    Cancel button and a "pending" text label; non-leaders get "Leave team" (confirm); the leader
    sees the "transfer leadership or delete" hint instead.
  - Jam page `EntryCard` (`entryPanelState` in `src/lib/jam-page.ts`): the "joined" state lists
    pending invites with Accept / Decline, and offers "Leave jam" (confirm). "has-entry" shows
    no Leave button, only the reason.
  - No in-app notifications (post-MVP): the invite form's success message tells the inviter to
    share the jam link.
- **Leadership transfer**: stays leader-only (current code). Closes the "Who transfers
  leadership" spec proposal; record it in `docs/decisions.md`.
- **Edge cases**: invitee leaves the jam (invites deleted); invitee joins another team or creates
  their own (accept fails, other invites deleted); two invites accepted concurrently (unique
  `[submissionId, userId]` on members + single-submission re-check inside the transaction);
  ranked jam with `allowContributorsAfterClose` during RATING: invites and accepts allowed,
  leaving and removal not.

## Checklist

- [x] 1. Schema + migration; domain rules with unit tests in `src/domain/submission.test.ts`
  and `participation.test.ts`. Verify: `pnpm test`.
- [x] 2. Leave jam + leave submission actions, rate limits on remove/transfer, integration tests
  in `tests/integration/jam-actions…` and `submission-actions…`. Verify: `pnpm test:integration`.
- [x] 3. Invite actions (invite, cancel, accept, decline), delete-on-create, loaders, integration
  tests covering every criterion above. Verify: `pnpm test:integration`.
- [x] 4. UI: `TeamManager`, jam page `EntryCard` + `entryPanelState` tests, mobile tap targets
  like the existing rows. Verify: `pnpm test`, then a browser check of invite → accept → leave
  team → leave jam, in light and dark themes.
- [x] 5. Seed: one pending invite in the ongoing jam. Docs: `docs/specs/requirements.md`
  (REQ-SUB-06 mentions acceptance), `docs/architecture.md` if it describes teams,
  `docs/decisions.md` (leader-only transfer), delete the two backlog lines, the two roadmap items
  and the spec proposal. Verify: `pnpm lint`, `pnpm build`.
