# Kubernetes deployment (ArgoCD / Corniland cluster)

Deploy GameJams Organizer 2 to the Corniland K8s cluster via GitOps (ArgoCD
app-of-apps), with two environments: `dev` and `prod`.

## Target platform

The `Corniland-K8sCluster` repo drives the cluster with an ArgoCD app-of-apps:

- `argocd/applications/root.yaml` auto-syncs every `Application` in that folder.
- Each app keeps its own K8s manifests **in its own repo** under `k8s/<env>/`
  (pattern already used by `udc-bot-dev` / `udc-bot-prod`).
- Infra provides: Traefik ingress, cert-manager (`letsencrypt-prod`, HTTP-01,
  hosts under `*.vps.corniland.ovh`), External Secrets Operator backed by
  1Password Connect (`ClusterSecretStore onepassword`, vaults `UDC`, `K8S`),
  Velero backups, Discord sync notifications.

## Decisions

- **Database**: in-cluster Postgres per env (StatefulSet + PVC). Backed up by Velero.
- **Registry**: GHCR, built by GitHub Actions in this repo.
  - App image: `ghcr.io/pierre-demessence/gamejams-organizer-2:latest` + `:sha-<commit>`.
  - Migrator image (Prisma CLI + migrations): same package, tag `:migrate`.
- **Migrations**: `prisma migrate deploy` run as an ArgoCD **Sync hook Job** using
  the migrator image, with a `wait-for-db` initContainer.
- **Secrets**: `ExternalSecret` per env pulls from 1Password items `gamejams-dev` /
  `gamejams-prod` (fields: `postgres-password`, `nextauth-secret`, `discord-id`,
  `discord-secret`) and templates `DATABASE_URL`.
- **Hostnames**: prod `gamejams.corniland.ovh`, dev `dev.gamejams.corniland.ovh`
  (point `gamejams.corniland.ovh` at the VPS and add a `*.gamejams.corniland.ovh` record).

## Prerequisites (manual, one-time)

- [ ] Create 1Password items `gamejams-dev` and `gamejams-prod` in the `K8S` vault
      with fields: `postgres-password`, `nextauth-secret`, `discord-id`, `discord-secret`.
- [ ] Configure the Discord OAuth app redirect URIs:
      `https://gamejams.corniland.ovh/api/auth/callback/discord` and the dev host.
- [ ] Point `gamejams.corniland.ovh` at the VPS and add a `*.gamejams.corniland.ovh` record.
- [ ] Make the GHCR package readable by the cluster (public, or add pull creds).

## Tasks

- [x] Add `/api/health` endpoint (no DB) for probes.
- [x] Add `migrator` stage to the Dockerfile.
- [x] Add GHCR build/push workflow (`.github/workflows/image.yml`).
- [x] Create `k8s/dev/` manifests (externalsecret, postgres, app, migrate-job).
- [x] Create `k8s/prod/` manifests.
- [x] Add `gamejams-dev.yaml` / `gamejams-prod.yaml` ArgoCD Applications to the cluster repo.
- [x] Update docs (`docs/deployment.md`, `docs/INDEX.md`).

## Image promotion

Dev tracks `:latest` (rolls on each push to main). Prod should be pinned to an
immutable `:sha-<commit>` tag and bumped by editing `k8s/prod/app.yaml` (promotion).
Follow-up option: install ArgoCD Image Updater for automated tag bumps.
