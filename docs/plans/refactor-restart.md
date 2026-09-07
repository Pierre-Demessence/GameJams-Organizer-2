# Refactor / Proper Restart Plan

Re-align the existing repo with the refined [product-spec.md](../specs/product-spec.md)
**in place** (no new repo). The audit showed the tech stack and the permission abstraction
are already the right shape, so this is a sequenced refactor — not a rewrite.

## Guiding order

1. **Get on solid ground first** — clean baseline, then refresh dependencies, so all later
   work happens on current tooling.
2. **Update "intended-state" docs before code** — the specs are the contract you build
   against, so they lead.
3. **Schema before code** — the data model is the foundation everything else depends on.
4. **Code from the inside out** — `lib` → server actions → UI, so each layer builds on a
   stable one below it.
5. **Update "current-state" docs after code** — tech-stack / codebase / features describe
   what exists, so they trail the implementation.
6. **Review, then finalize.**

---

## Phase 0 — Baseline & safety

- [x] Confirm a clean git working tree; create a working branch (e.g. `refactor/spec-align`).
- [x] Tag or note the current commit as the pre-refactor baseline (easy rollback point).
      Baseline commit: `65c23f2`.
- [x] Run the full green baseline: `pnpm install`, `pnpm build`, `pnpm lint`, `tsc --noEmit`.
      Recorded green before changes (build had non-fatal Windows standalone-copy warnings).
- [x] Confirm the database is dev-only / disposable (migrations will reshape it).

## Phase 1 — Dependency & tooling refresh

Resolved decisions:
- **Node 24.20.0** (LTS) pinned via Volta; Node 26 rejected (marginal benefit, still Current).
- **Prisma 7.10.0** stable kept; Prisma 8 rejected (RC + full ORM rewrite, ~zero MVP benefit).
- **TypeScript 5.9.3** and **ESLint 9** kept; TS 7 + ESLint 10 rejected — TS 7 crashes
  `typescript-eslint` (no supported release yet) so linting breaks.
- Everything else taken latest: Next 16.3.4, React 19.2.8, Tailwind 4.3.3, Zod 4.5.4,
  lucide-react 1.41, @base-ui/react 1.8, pg 8.23, prettier 3.9, tsx 4.23, etc.
- Removed deprecated `@types/bcryptjs`.
- Volta gotcha: pnpm was bound to Node 22.11 (< Prisma's 22.12 floor); rebound to Node 24.

- [x] List outdated packages (`pnpm outdated`) and note majors vs minors.
- [x] **Decision point:** bleeding-edge posture — resolved as above.
- [x] Apply the agreed updates; regenerate the Prisma client (`pnpm db:generate`).
- [x] Fix any breakages from the updates; re-green build / lint / typecheck.
- [x] Commit the dependency refresh on its own (isolated, easy to bisect). `22c01c3`

## Phase 2 — Align the "intended-state" docs (the contract)

`product-spec.md` is the new north star. Reconcile the derived docs to it before coding.

- [x] **requirements.md** — update the EARS requirements to match the refined spec
      (stacking roles, submission DRAFT/SUBMITTED, itch.io verification, moderation switches,
      criterion source/primary).
- [x] **design.md** — update the technical design: permission-based access, three moderation
      switches, submission lifecycle + ownership verification, single itch.io link + supported
      platforms, criterion `source`/`primary`, scoring (primary vs weighted-average overall).
- [x] **tasks.md** — rebuild the implementation task list from the updated design.
- [x] **features.md** — reconcile the MVP feature table with the spec (what's in vs deferred).
- [x] **DRAFT.md** — archive: move `docs/specs/DRAFT.md` → `docs/archived/DRAFT.md` with a
      one-line "archived because superseded by product-spec.md" note.
- [x] **INDEX.md** — update the table of contents for any moved/added docs.

## Phase 3 — Schema migration (the foundation)

One Prisma migration (or a small ordered set), then regenerate the client. Ordered by dependency.

- [x] **Role stacking** — change `JamRole` `@@unique([jamId, userId])` →
      `@@unique([jamId, userId, role])` so a user can hold several roles.
- [x] **Submission lifecycle** — add a `status` (DRAFT / SUBMITTED) to `Submission`.
- [x] **Moderation switches** — replace `disqualified` / `hidden` booleans with the three
      independent switches (visible / rateable / competing) + a moderation reason/badge field.
- [x] **Links** — collapse per-platform `linkWindows/Mac/Linux/Web` into a single itch.io
      project URL + a `supportedPlatforms` multi-select.
- [x] **Ownership verification** — add the fields for the code-on-page flow (issued code,
      verified state/timestamp).
- [x] **Criterion** — add `source` (RATED / JURY) and `primary`.
- [x] **Theme reveal default** — set `revealThemeOnStart` default to `true` (spec §7: on by default).
- [x] Generate the migration, regenerate the client, confirm it applies cleanly on a fresh DB.

## Phase 4 — Code refactor (inside out: lib → actions → UI)

Re-green build / lint / typecheck after each numbered step.

- [x] **1. `permissions.ts`** — `getJamRole` (findUnique) → `getJamRoles` (findMany), union the
      bundled permissions. This is the keystone; call sites using `checkJamPermission` need no
      change.
- [x] **2. Kill inline role leaks** — route the direct `jam.roles.some(... === "ADMIN")` checks
      in `jams/[slug]/page.tsx` and `results/page.tsx` through the permission helper.
- [x] **3. Role assignment** — `manage/actions.ts` upsert-on-`(jamId,userId)` → add/remove per
      role; update the manage UI to show/edit stacked roles.
- [x] **4. Moderation** — rewire the three switches through `scoring.ts`, `submissions/actions.ts`,
      the submission page, `submission-list`, `moderation-actions`, and the rate flow; update badges.
- [x] **5. Submission lifecycle & links** — implement DRAFT/SUBMITTED flow; swap per-platform
      links for the single itch.io URL + supported-platforms selector.
- [x] **6. Ownership verification** — issue the per-project code, the fetch-and-verify action
      (single-host itch.io allowlist, timeout, size cap), and the manual admin fallback.
- [x] **7. Criteria & scoring** — honor `source`/`primary`; overall = primary's ranking when set,
      else weighted average of RATED criteria.
- [x] **8. Rate limiting / validations** — extend `validations.ts` (Zod) and rate limits to cover
      the new inputs (itch.io URL, verification, roles).

## Phase 5 — Seed & test data

- [x] Update `prisma/seed.ts` to the new schema: stacked roles, submission statuses, verified
      submissions, criteria with source/primary, itch.io links + platforms.

## Phase 6 — End-to-end verification

- [x] Full build / lint / typecheck green.
- [ ] Manual click-through of the core flows in the browser (create jam → submit → verify →
      rate → results), including the new moderation switches and stacked roles.

## Phase 7 — Refresh the "current-state" docs

Now that the code reflects the spec, update the docs that describe what exists.

- [x] **tech-stack.md** — bump versions to what's actually installed after Phase 1.
- [x] **codebase.md** — reflect new/changed modules (verification, moderation, roles).
- [x] **features.md** — mark what's now built vs deferred.
- [x] **configuration.md / installation.md** — any new env vars (e.g. verification/fetch config).
- [x] **CHANGELOG.md** — record the refactor.
- [x] **README.md** — update the one-page summary if anything user-facing changed.
- [x] **agent/README.md** — update invariants (permission-based checks, moderation switches).

## Phase 8 — Review & finalize

- [ ] Run the mandatory peer-review loop on the changes; fix all actionable items; repeat until clean.
- [ ] Tick every box above; move this plan `docs/plans/refactor-restart.md` →
      `docs/plans/done/` in the final commit.
