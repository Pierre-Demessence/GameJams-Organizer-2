# GameJam Organizer

Create, join, and rate game jams. Free and open source.

## Features

- Sign in with Discord or email and password, and link both to one account
- Host jams with a Markdown description, tags, custom submission questions and rating
  criteria; publish when the "Ready to publish?" checklist passes
- Jam lifecycle driven by dates: upcoming → live → rating → finished
- Browse and search jams (⌘K / Ctrl+K from anywhere)
- Team submissions with itch.io ownership verification
- Rate entries on every criterion; live-computed results with podium and per-criterion rankings
- Stackable organizer roles (Admin, Moderator, Judge, Host) and moderation switches
- Platform admin: deleted content with restore, audit log, staff
- Dark-first design with a light theme, mobile-friendly

## Getting started

**Prerequisites:** Node.js 24+, pnpm 9 (`corepack enable`), Docker Desktop (for PostgreSQL).

```bash
pnpm install
cp .env.example .env      # defaults work with the docker-compose database
docker compose up db -d   # PostgreSQL 16 on port 5432
pnpm db:migrate           # apply migrations and generate the Prisma client
pnpm db:seed              # optional: sample users, jams, submissions and ratings
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**Discord sign-in (optional):** create an app in the
[Discord Developer Portal](https://discord.com/developers/applications), add the redirect URI
`http://localhost:3000/api/auth/callback/discord`, and set `AUTH_DISCORD_ID` /
`AUTH_DISCORD_SECRET` in `.env`.

## Tests

```bash
pnpm test               # unit tests
pnpm test:integration   # server actions against Postgres (needs the database running)
pnpm test:e2e           # Playwright (needs the app and a seeded database)
```

## Documentation

- [Configuration](docs/configuration.md): environment variables
- [Deployment](docs/deployment.md): Kubernetes (ArgoCD) and Docker Compose
- [Architecture](docs/architecture.md) and [product spec](docs/specs/product-spec.md)
- [Backlog](docs/backlog.md)
- Contributors and coding agents: [AGENTS.md](AGENTS.md)
