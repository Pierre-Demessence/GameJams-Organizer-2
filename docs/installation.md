# Installation

## Prerequisites

- **Node.js** 22+ — [download](https://nodejs.org/)
- **pnpm** 9+ — `corepack enable` (ships with Node.js 22)
- **Docker Desktop** — [download](https://www.docker.com/products/docker-desktop/) (for PostgreSQL)

## Local Development Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` if you need custom database credentials. The defaults work out of the box with the docker-compose database.

### 3. Start the database

```bash
docker compose up db -d
```

This starts PostgreSQL 16 on port 5432 with credentials from `.env`.

### 4. Push schema and generate client

The database must be running before this step.

```bash
npx prisma db push
pnpm db:generate
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Optional: Seed the database

```bash
pnpm db:seed
```

## Optional: Discord OAuth

1. Create an app at [Discord Developer Portal](https://discord.com/developers/applications)
2. Add redirect URI: `http://localhost:3000/api/auth/callback/discord`
3. Set `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET` in `.env`

## Useful Commands

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Start dev server with hot reload |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `npx prisma studio` | Open database GUI |
| `npx prisma db push` | Push schema changes to database |

## Production Deployment

See [README.md](../README.md#production-deployment-docker) for Docker-based production deployment.
