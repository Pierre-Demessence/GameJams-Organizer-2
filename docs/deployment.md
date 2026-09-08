# Kubernetes deployment (Corniland cluster)

The app deploys to the Corniland K8s cluster via **ArgoCD GitOps**. Two
environments are supported:

| Env  | Host                                  | Namespace       | Manifests   |
| ---- | ------------------------------------- | --------------- | ----------- |
| dev  | `dev.gamejams.corniland.ovh`          | `gamejams-dev`  | `k8s/dev/`  |
| prod | `gamejams.corniland.ovh`              | `gamejams-prod` | `k8s/prod/` |

## How it fits together

- **Images** are built by [`.github/workflows/image.yml`](../.github/workflows/image.yml)
  on every push to `main` and pushed to GHCR:
  - app: `ghcr.io/pierre-demessence/gamejams-organizer-2:latest` (+ `:sha-<commit>`)
  - migrator (Prisma CLI + migrations): `…:migrate`
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
   `discord-secret`.
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

- **dev**: push to `main` → new image → ArgoCD rolls it out (tracks `:latest`).
- **prod**: pin `image:` in [`k8s/prod/app.yaml`](../k8s/prod/app.yaml) to an
  immutable `:sha-<commit>` tag and commit to promote a specific build.

## Seeding dev with test data

Seeding is manual and dev-only (the seed script resets data on each run):

```sh
kubectl -n gamejams-dev create -f k8s/dev/manual/seed-job.yaml
```

The Job lives in `k8s/dev/manual/`, which ArgoCD ignores (non-recursive sync), so
it never runs automatically or gets pruned.

For local runs (app + Postgres + migrations) use [`docker-compose.yml`](../docker-compose.yml)
— see the [README](../README.md#production-deployment-docker).
