# MVP-2 Mandatory TOTP 2FA for staff

Roadmap MVP item 2, spec §10 "Authentication and sensitive actions", REQ-ADMIN-03.

## Goal

Staff powers work only in a browser that has passed a TOTP check, whatever the sign-in
provider, so a stolen Discord or password login alone gives no staff access.

## Acceptance criteria

- WHEN a staff member without an enrolled authenticator opens `/admin`, THE SYSTEM SHALL
  redirect them to `/admin/two-factor`, which shows a QR code and the manual key and enables 2FA
  once a valid code is entered.
- WHEN an enrolled staff member opens `/admin` without a valid 2FA cookie, THE SYSTEM SHALL
  redirect them to `/admin/two-factor` and ask for a code.
- WHILE a staff member's browser has no valid 2FA cookie, `checkStaffPermission` SHALL return
  false, so every staff action and staff-only control behaves as for a normal user.
- WHEN a valid code is entered, THE SYSTEM SHALL set a signed, HttpOnly, SameSite=Strict cookie
  bound to the user id that expires after 12 hours.
- IF a code was already used (same or earlier 30-second step), or is wrong, THEN THE SYSTEM
  SHALL refuse it; verify attempts are rate-limited per user.
- WHEN a Site Admin resets another staff member's 2FA, THE SYSTEM SHALL clear that member's
  secret, so they enrol again on their next `/admin` visit. A staff member cannot reset or
  disable their own 2FA.
- THE SYSTEM SHALL audit enrolment, failed verifications and resets (`auth:2fa_enrol`,
  `auth:2fa_failed`, `staff:2fa_reset`).
- THE admin board SHALL show the "2FA verified" badge for the current session and a per-staff
  "2FA on / off" status (as on the design canvas Admin board, `docs/design-system.md`), each
  with a text label, not color alone.
- THE SYSTEM SHALL store TOTP secrets encrypted (AES-256-GCM) with `TOTP_ENCRYPTION_KEY`.

## Design

- **Libraries** (runtime deps, approved with this plan): `otpauth` (TOTP: secret, `otpauth://`
  URI, validate with window ±1) and `qrcode` (render the URI to a data URL shown in an `<img>`,
  never injected as HTML). Check current stable versions before adding; run `pnpm audit`.
- **Schema** (`User`): `totpSecret String?` (encrypted, base64 `iv.tag.ciphertext`),
  `totpEnabledAt DateTime?` (null while enrolment is pending), `totpLastStep Int?` (replay
  guard). One SQL migration via `pnpm db:migrate`.
- **Rule** `src/domain/staff.ts`: `staffAccess({ hasRole, enrolled, verified })` → `Decision`
  with reasons "Set up two-factor authentication" / "Enter your two-factor code". Unit-tested.
- **`src/lib/two-factor.ts`** (server-only): encrypt/decrypt secret, `startEnrolment`,
  `verifyCode` (validate + `totpLastStep` check-and-set in one `updateMany` guarded on the old
  step, so two concurrent submits of one code cannot both pass), cookie sign/verify (HMAC-SHA256
  over `userId.expiresAt`, key derived from `NEXTAUTH_SECRET` with HKDF label `staff-2fa`,
  `timingSafeEqual`), `hasVerifiedTwoFactor(userId)` reading `cookies()`. Keep sign/verify and
  encrypt/decrypt as pure functions with unit tests.
- **Cookie**: `staff-2fa` (`__Host-staff-2fa` when the app URL is https), Secure on https,
  Path `/`, Max-Age 12 h. A sign-out leaves it, but it is bound to the user id and expires, so
  another account in the same browser gets nothing from it.
- **Gate**: `checkStaffPermission` (`src/lib/staff-permissions.ts`) keeps its signature and
  also requires `staffAccess(...).allowed`; no call-site changes in `jams/actions.ts` and
  `submissions/actions.ts`. `isStaff` in the JWT stays a UI hint only.
- **Pages/actions**: `src/app/admin/two-factor/page.tsx` (enrol or verify, using the
  `AuthShell` card from `src/app/(auth)/auth-shell.tsx`; `safeCallbackPath` for the return URL),
  `src/app/admin/two-factor/actions.ts` (`startEnrolmentAction`, `confirmEnrolmentAction`,
  `verifyTwoFactorAction`; Zod: 6 digits), `resetTwoFactorAction(userId)` in
  `src/app/admin/actions.ts` gated on `manage_staff`. Every action calls `checkRateLimit`.
  `/admin` checks `staffAccess` before `view_audit_log` and redirects.
- **Recovery**: another Site Admin resets. The last admin's lockout is a documented SQL step in
  `docs/deployment.md` (null the three columns). Recovery codes go to the backlog.
- **Failure modes**: missing or malformed `TOTP_ENCRYPTION_KEY` → enrolment and verify fail
  with a clear server error, never store a plaintext secret. Clock skew beyond ±30 s → code
  refused.

## Checklist

Status: implemented and verified in worktree `feat/staff-totp` (not committed); only the final-commit deletion of this plan and the roadmap line (already removed) remains.

- [x] Baseline: `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm build`; note failures.
- [x] Add `otpauth`, `qrcode` (+ `@types/qrcode`); migration for the three `User` columns.
- [x] `src/domain/staff.ts` + tests; `src/lib/two-factor.ts` + tests for the pure parts.
- [x] Gate `checkStaffPermission`; update `src/lib/staff-permissions.test.ts`.
- [x] Integration setup: mock `next/headers` `cookies()` with an in-memory jar reset per test
  (`tests/integration/setup.ts`); a factory helper that enrols a staff user and sets a valid
  cookie; fix existing staff tests (`admin-actions`, `jam-actions`, `submission-actions`).
- [x] Integration tests: unverified staff is refused, verified passes, replayed code refused,
  expired / foreign-user cookie refused, reset clears the secret and is audited, self-reset
  refused.
- [x] `/admin/two-factor` page and actions; `/admin` redirect; badge and per-staff status plus
  "Reset 2FA" button in `src/app/admin/staff-manager.tsx`; audit labels/filter in
  `src/lib/admin.ts` if needed.
- [x] Env: `TOTP_ENCRYPTION_KEY` in `.env.example`, `docs/configuration.md` (generate with
  `openssl rand -base64 32`), `k8s/{dev,prod}/externalsecret.yaml`, the 1Password prod setup
  list in `docs/deployment.md`, and the integration test env.
- [x] Docs: `docs/architecture.md` (auth flow + Security row), `AGENTS.md` invariant ("staff
  powers need `staffAccess`; never bypass `checkStaffPermission`"), `docs/decisions.md` (signed
  cookie rather than a JWT claim: a client `update()` can send arbitrary session data), backlog
  (recovery codes; 2FA for non-staff users), delete the MVP 2FA backlog line.
- [x] Verify in the browser with the seeded admin (`alice@example.com`): enrol with an
  authenticator, reload, reset another staff member, light and dark themes, 390 px width.
- [x] Lint, unit, integration, build pass with no new problems; peer review (fresh Sonnet,
  read-only) against these criteria.
- [ ] Delete this plan and the roadmap line in the final commit.

## Running alongside MVP-4

`docs/plans/delete-account.md` also migrates `User`. Run each plan in its own worktree **with its
own databases** (in the worktree's `.env`: `DATABASE_URL=…/gamejams_2fa`,
`TEST_DATABASE_URL=…/gamejams_2fa_test`), or `prisma migrate dev` and the integration global
setup see the other branch's migrations as drift and offer to reset the shared database. Merge
one branch first; the second merge keeps both sets of `User` columns in `schema.prisma`, and
whichever lands second clears the other's new `User` fields where it needs to (the
delete-account tombstone also nulls the TOTP columns).
