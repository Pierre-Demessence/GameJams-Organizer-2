# Configuration

All configuration is done through environment variables. Copy `.env.example` to `.env` and edit as needed.

## Environment Variables

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://gamejams:gamejams@localhost:5432/gamejams` | PostgreSQL connection string |
| `POSTGRES_USER` | Yes | `gamejams` | Database username (used by docker-compose) |
| `POSTGRES_PASSWORD` | Yes | `gamejams` | Database password — use a strong random value in production |
| `POSTGRES_DB` | Yes | `gamejams` | Database name (used by docker-compose) |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXTAUTH_SECRET` | Yes | — | Signing secret for Auth.js JWT tokens. Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` | Public URL of the application |

### Discord OAuth (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_DISCORD_ID` | No | — | Discord OAuth application client ID |
| `AUTH_DISCORD_SECRET` | No | — | Discord OAuth application client secret |

To configure Discord OAuth:

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Under OAuth2, add a redirect URI: `{NEXTAUTH_URL}/api/auth/callback/discord`
4. Copy the Client ID and Client Secret into `.env`

## Docker-Specific Notes

In the docker-compose setup, `DATABASE_URL` is automatically constructed from `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. You only need to set the individual `POSTGRES_*` variables in `.env`.

## Security Notes

- Never commit `.env` to version control (it is gitignored).
- In production, use strong random values for `POSTGRES_PASSWORD` and `NEXTAUTH_SECRET`.
- The default dev credentials (`gamejams/gamejams`) are only safe for local development.
