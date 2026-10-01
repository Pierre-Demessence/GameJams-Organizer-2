# Roadmap

Milestones in order. Details for each item live in `docs/backlog.md`; a non-trivial item gets
its own `docs/plans/<feature>.md` when work starts. Delete a milestone once it is reached.

## MVP: first prod release

Order of work:

1. Leave a jam / leave a submission (spec §4.7).
2. Mandatory TOTP 2FA for staff (spec §10).
3. Contributor invites with acceptance (spec §5).
4. Settings → Delete account, once its product rules are decided.
5. Mobile designs for the organizer screens.

Done when:

- No `[MVP]` line is left in `docs/backlog.md`.
- The rate limiter is shared across pods and `isStaff` is refreshed in the `jwt` callback (both
  under Known issues), since prod runs 2 replicas.
- The Operations checks pass: prod one-time setup confirmed, Velero restore tested, full manual
  regression pass on the release build.
