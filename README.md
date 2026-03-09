# GameJam Organizer

Create, join, and rate game jams. Free and open source.

## Quick Start (Development)

**Prerequisites:** Node.js 22+, pnpm, Docker Desktop

```bash
# Clone and install
pnpm install

# Start the database
docker compose up db -d

# Push schema and generate client
cp .env.example .env  # Edit credentials if needed
npx prisma db push
npx prisma generate

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production Deployment (Docker)

```bash
# 1. Create .env from the example and fill in production values
cp .env.example .env

# 2. Generate a secure auth secret
openssl rand -base64 32
# Paste the output as NEXTAUTH_SECRET in .env

# 3. Set NEXTAUTH_URL to your domain (e.g. https://jams.example.com)
# 4. Set a strong POSTGRES_PASSWORD
# 5. Optionally configure Discord OAuth credentials

# 6. Build and start
docker compose up -d --build

# 7. Push the database schema (first run or after schema changes)
docker compose run --rm migrate
```

The app runs on port 3000. Place a reverse proxy (nginx, Caddy) in front for TLS.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-set by docker-compose) |
| `POSTGRES_USER` | Yes | Database username |
| `POSTGRES_PASSWORD` | Yes | Database password — use a strong random value in production |
| `POSTGRES_DB` | Yes | Database name |
| `NEXTAUTH_SECRET` | Yes | Auth.js signing secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Public URL of the app (e.g. `https://jams.example.com`) |
| `AUTH_DISCORD_ID` | No | Discord OAuth app client ID |
| `AUTH_DISCORD_SECRET` | No | Discord OAuth app client secret |

## Tech Stack

- **Next.js 16** (App Router, TypeScript, standalone output)
- **Prisma 7** (PostgreSQL, driver adapter)
- **Auth.js v5** (JWT, Discord + Credentials)
- **shadcn/ui** + Tailwind CSS v4
- **Docker** (multi-stage build, PostgreSQL 16)

## Documentation

See [docs/INDEX.md](docs/INDEX.md) for full documentation.
