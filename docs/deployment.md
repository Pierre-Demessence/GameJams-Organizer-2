# Kubernetes deployment (Corniland cluster)

The app deploys to the Corniland K8s cluster via **ArgoCD GitOps**. Two
environments are supported:

| Env  | Host                                  | Namespace       | Manifests   |
| ---- | ------------------------------------- | --------------- | ----------- |
| dev  | `dev.gamejams.corniland.ovh`          | `gamejams-dev`  | `k8s/dev/`  |
| prod | `gamejams.corniland.ovh`              | `gamejams-prod` | `k8s/prod/` |

## How it fits together

- **Images** are built by the reusable [`build.yml`](../.github/workflows/build.yml)
  and pushed to GHCR:
  - app: `ghcr.io/pierre-demessence/gamejams-organizer-2:<sha>` (+ `:latest`)
  - migrator (Prisma CLI + migrations): `…:migrate-<sha>` (+ `:migrate`)
- **Manifests** live in this repo under `k8s/<env>/`:
  - `externalsecret.yaml` — pulls secrets from 1Password and templates `DATABASE_URL`.
  - `postgres.yaml` — in-cluster Postgres (StatefulSet + PVC), backed up by Velero.
  - `app.yaml` — Deployment + Service + Traefik Ingress (TLS via cert-manager).
  - `migrate-job.yaml` — ArgoCD Sync-hook Job running `prisma migrate deploy`.
- **ArgoCD Applications** `gamejams-dev` / `gamejams-prod` live in the cluster repo
  (`argocd/applications/`) and auto-sync each env from `k8s/<env>/`.

## One-time setup

1. **1Password**: create items `gamejams-dev` and `gamejams-prod` in the `K8S`
   vault with fields `postgres-password`, `nextauth-secret`, `discord-id`,
   `discord-secret`. Optionally add `initial-admin-emails` (comma-separated) to
   bootstrap the first Site Admin — see "Bootstrapping the first admin" below.
2. **Discord OAuth**: add redirect URIs
   `https://gamejams.corniland.ovh/api/auth/callback/discord` and
   `https://dev.gamejams.corniland.ovh/api/auth/callback/discord`
   (Discord Developer Portal → your app → OAuth2 → Redirects).
3. **DNS**: point `gamejams.corniland.ovh` at the VPS IP, and add a
   `*.gamejams.corniland.ovh` record (→ VPS IP) so `dev.gamejams.corniland.ovh`
   (and future sub-envs) resolve.
4. **GHCR access**: make the package public, or add image pull credentials.
5. Commit the two ArgoCD `Application` files in the cluster repo; the `root` app
   picks them up automatically.

## Deploying changes

Deploys are **commit-back GitOps**: CI builds an immutable image, rewrites the
`image:` tags in `k8s/<env>/`, and commits to `main`; ArgoCD then rolls the change.

- **dev**: push to `main` → [`deploy-dev.yml`](../.github/workflows/deploy-dev.yml)
  builds and pins `k8s/dev` to the new `:<sha>` → ArgoCD deploys. The commit only
  touches `k8s/**`, which the trigger ignores, so it never loops.
- **PR → dev**: run `deploy-dev.yml` via **workflow_dispatch** with a `pr_number`
  (or `ref`) to test a branch on dev; it comments the result on the PR.
- **prod**: publish a GitHub **Release** →
  [`deploy-prod.yml`](../.github/workflows/deploy-prod.yml) builds the release
  commit and pins `k8s/prod` to that `:<sha>` → ArgoCD deploys. `workflow_dispatch`
  (with a `ref`) also works for manual promotion.

Roll back by re-running `deploy-prod.yml` against an earlier tag/ref (or reverting
the manifest commit).

## Seeding dev with test data

Seeding is manual and dev-only (the seed script resets data on each run):

```sh
kubectl -n gamejams-dev create -f k8s/dev/manual/seed-job.yaml
```

The Job lives in `k8s/dev/manual/`, which ArgoCD ignores (non-recursive sync), so
it never runs automatically or gets pruned.

## Bootstrapping the first admin

Prod starts with an empty database and is not seeded, so no Site Admin exists and
`/admin` is unreachable. To bootstrap:

1. Add an `initial-admin-emails` field (comma-separated) to the `gamejams-prod`
   (and/or `gamejams-dev`) 1Password item with your account email.
2. ArgoCD syncs the `gamejams-admin` ExternalSecret; restart the app so it picks
   up the new env: `kubectl -n gamejams-prod rollout restart deploy/gamejams`.
3. Sign in once with that email \u2014 you're granted `SITE_ADMIN` automatically
   (idempotent). From then on, manage admins from `/admin`.

The value is consumed via an *optional* `envFrom`, so if the field is absent the
app still starts normally (admin bootstrap just stays inactive).

For local runs (app + Postgres + migrations) use [`docker-compose.yml`](../docker-compose.yml)
— see the [README](../README.md#production-deployment-docker).
