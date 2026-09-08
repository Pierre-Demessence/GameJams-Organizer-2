# Tech Stack

## Core

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js (App Router) | 16.3.4 | Full-stack React framework, standalone output |
| Language | TypeScript | 5.9.3 | Type safety across client and server |
| Runtime | Node.js | 24.20.0 (pinned via Volta) | Server runtime |
| Package Manager | pnpm | 9.12.3 (pinned) | Fast, disk-efficient package manager |

## Data & Auth

| Technology | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 16 (alpine) | Relational database |
| Prisma | 7.10.0 | Type-safe ORM, schema-first, SQL migrations |
| Auth.js (NextAuth v5) | 5.0.0-beta.30 | Authentication (JWT strategy) |

## UI

| Technology | Version | Purpose |
|-----------|---------|---------|
| Tailwind CSS | 4.x | Utility-first CSS framework |
| shadcn/ui | latest | Accessible component primitives (uses `@base-ui/react`) |
| Geist Font | — | Default font family |

## Validation & Utilities

| Technology | Version | Purpose |
|-----------|---------|---------|
| Zod | 4.5.4 | Runtime + type-level schema validation |

## Testing

| Technology | Version | Purpose |
|-----------|---------|---------|
| Vitest | 5.x | Unit tests (colocated `*.test.ts`) + integration tests (`integration/`, real Postgres) |
| Playwright | 1.63 | End-to-end browser tests (`e2e/`) |

## Infrastructure

| Technology | Version | Purpose |
|-----------|---------|---------|
| Docker | — | Containerized deployment (multi-stage build) |
| docker-compose | — | Service orchestration (app + db + migrate) |

## Minimum Supported Versions

- **Node.js**: 24+
- **pnpm**: 9.x
- **PostgreSQL**: 16+
- **Docker Engine**: 20+
- **Docker Compose**: v2+
