# CI/CD image build + GitOps deploy (dev + prod)

Replace the moving-`:latest` + manual-restart flow with commit-back GitOps, so
ArgoCD always sees an immutable image tag change and rolls automatically. Mirrors
the UDC-Bot pattern (reusable `build.yml` + `deploy.yml`), adapted for this repo's
second (migrator) image.

## Triggers

- **dev**: push to `main` (ignoring `k8s/**`, `docs/**`, `**/*.md`) → build → bump
  `k8s/dev` image tags → commit → ArgoCD deploys. Also `workflow_dispatch` (PR # or
  ref) to test a branch/PR on dev.
- **prod**: publish a GitHub **Release** → build the release commit → bump `k8s/prod`
  image tags → commit → ArgoCD deploys. Also `workflow_dispatch` (ref).

## Tagging

- app image: `ghcr.io/pierre-demessence/gamejams-organizer-2:<sha>` (+ `:latest`).
- migrator image: `…:migrate-<sha>` (+ `:migrate`).
- Manifests are pinned to `:<sha>` / `:migrate-<sha>` (immutable) so ArgoCD detects
  the change. Per-env sha pinning keeps prod migrations isolated from dev's.

## Loop avoidance

- The deploy commit only touches `k8s/**`; the dev push trigger has
  `paths-ignore: k8s/**`, so the bump commit never retriggers a build.
- Commits use the default `GITHUB_TOKEN`, whose pushes do not trigger workflows —
  a second layer of loop protection. (Upgrade to a GitHub App token if `main` gains
  branch protection that blocks Actions pushes.)

## Tasks

- [x] `build.yml` reusable workflow (app + migrator images).
- [x] `deploy.yml` reusable workflow (sed image tags + commit-back).
- [x] `deploy-dev.yml` (push main + workflow_dispatch).
- [x] `deploy-prod.yml` (release published + workflow_dispatch).
- [x] Remove `image.yml` (superseded).
- [x] Update `docs/deployment.md`.

## Prerequisites

- `main` must allow the Actions bot (`GITHUB_TOKEN`) to push directly — no branch
  ruleset blocking it. If `main` is protected, either exempt GitHub Actions or
  switch the commit-back step to a GitHub App token (as UDC-Bot does).
- Optionally create GitHub Environments `dev` and `prod` (add required reviewers to
  `prod` for a manual approval gate).
