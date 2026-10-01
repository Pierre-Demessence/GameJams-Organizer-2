# Plan: Align the repo with the current workflow instructions

## Goal

Restructure the docs to the current layout (`README.md`, `AGENTS.md`, `docs/backlog.md`,
`docs/decisions.md`, optional `docs/roadmap.md` and topic docs, `docs/plans/` for work in
progress only). No product code changes.

## Acceptance criteria

- WHEN an agent opens the repo, THE SYSTEM SHALL provide a root `AGENTS.md` holding the
  commands, layout, conventions, invariants and non-obvious stack facts (no `CLAUDE.md`).
- WHEN a human opens `README.md`, THE SYSTEM SHALL show what the app is, how to install and
  run it, and a short feature list, linking out to topic docs instead of duplicating them.
- THE SYSTEM SHALL contain no `docs/INDEX.md`, `docs/archived/`, `docs/plans/done/`,
  `docs/agent/`, or docs that only restate `package.json` or the folder tree.
- WHEN work is deferred or still open (unticked plan steps, open spec tasks, parked plans),
  THE SYSTEM SHALL list it in `docs/backlog.md`, one line each, with a `file:line` pointer
  where relevant.
- WHEN a non-obvious decision is recorded in a plan, spec or archived doc, THE SYSTEM SHALL
  carry it into `docs/decisions.md` (what, why, rejected alternatives) before that file is
  deleted.
- IF a living doc holds done, reversed or "superseded" items, THEN THE SYSTEM SHALL delete
  them rather than mark them.
- WHEN the work is finished, THE SYSTEM SHALL have no broken relative links in `README.md`,
  `AGENTS.md` or `docs/`.

## Design

File-by-file target (D = default decision, confirm or override):

| Current | Target |
| --- | --- |
| `docs/agent/README.md` | Becomes `AGENTS.md` (root); gains the conventions and "where to add new code" table from `codebase.md` and the non-config stack facts from `tech-stack.md` (Auth.js v5 beta JWT, base-ui not Radix, Zod v4, Tailwind v4). Drop the "Important paths" rows that only restate the tree |
| `docs/codebase.md`, `docs/tech-stack.md` | Deleted after the merge above |
| `docs/features.md` | Short feature list moves to `README.md`; "not yet built" / "deferred" rows already live in `backlog.md`. Deleted |
| `README.md` | Trimmed: description, features, install + run (absorbs `installation.md`), test commands, links to `configuration.md` / `deployment.md`. Env-var table, Docker prod steps and tech stack removed |
| `docs/installation.md` | Merged into `README.md`; deleted |
| `docs/configuration.md`, `docs/deployment.md`, `docs/design-system.md` | Kept as topic docs; Docker prod steps from README move into `deployment.md` |
| `docs/INDEX.md` | Deleted |
| `docs/archived/DRAFT.md` | Deleted (git keeps it); drop the reference in `product-spec.md:8` |
| `docs/plans/done/*` (6 files) | Decisions from `integration-tests.md`, `k8s-deployment.md`, `domain-layer.md`, `cicd-gitops-deploy.md` → `decisions.md`; the 4 unticked k8s ops steps (`k8s-deployment.md:34-39`) → backlog if still open; deleted |
| `docs/plans/refactor-restart.md` | D: unticked manual click-through → backlog as "full manual regression pass"; stale peer-review step dropped; deleted |
| `docs/plans/ppr-cache-components-migration.md` | D: deferral + key finding (global `cacheComponents` flag, footer `new Date()` blocker) → `decisions.md`; one-line backlog entry; deleted |
| `docs/specs/tasks.md` | Open T-704, T-705, T-861 → backlog; deleted |
| `docs/specs/design.md` | "Key architectural decisions" → `decisions.md`; the rest → `docs/architecture.md` (Q1) |
| `docs/specs/product-spec.md`, `requirements.md` | Kept: product contract read by agents, updated on product decisions |
| `CHANGELOG.md` | D: deleted — pre-v1 and not a published package |
| `docs/backlog.md` | Rewritten to one line per item with pointers and optional milestone tags; done "Redesign" entries and plan links removed |
| `docs/decisions.md` | New |
| `docs/roadmap.md` | Not created (Q2) |

Also: style sweep of remaining docs (present tense, no "previously / superseded", no
timestamps); `.gitignore` already covers `.env*`, build and test output — no change.

Resolved:

- **Q1** `specs/design.md` becomes the trimmed topic doc `docs/architecture.md` (layers, auth
  flow, lifecycle, scoring, results visibility, security); the schema copy is dropped.
- **Q2** No `docs/roadmap.md`; backlog lines carry `[MVP]` / `[post-MVP]` tags.

## Checklist

- [x] Write `docs/decisions.md` from plans, specs and the PPR finding
- [x] Rewrite `docs/backlog.md` (add open items above, drop done entries and dead links)
- [x] Create `AGENTS.md`; delete `docs/agent/`, `codebase.md`, `tech-stack.md`
- [x] Trim `README.md`; merge `installation.md`, move Docker steps to `deployment.md`;
      delete `features.md`, `installation.md`
- [x] Apply Q1 to `specs/design.md`; delete `specs/tasks.md`
- [x] Apply Q2 (`roadmap.md` and/or backlog tags)
- [x] Delete `INDEX.md`, `archived/`, `plans/done/`, `refactor-restart.md`, PPR plan,
      `CHANGELOG.md`; fix references
- [x] Style sweep + relative-link check across `README.md`, `AGENTS.md`, `docs/`
- [x] Run `pnpm lint` and `pnpm build` (docs-only, but confirm nothing references removed files)
- [x] Peer review against the acceptance criteria; fix and repeat (max 3 rounds)
- [ ] Delete this plan in the final commit (or a second commit if it was never committed)

Status: all work done and reviewed (1 round, no blocking findings); uncommitted. Next: commit on request, deleting this plan.
