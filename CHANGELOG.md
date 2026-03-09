# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2025-07-10

### Added

- User authentication: Discord OAuth and email/password sign-up/sign-in
- User profiles with username, bio, avatar, and jam history
- Account settings: edit profile, link/unlink OAuth providers
- Jam creation with name, slug, description, dates, themes, and rating criteria
- Jam lifecycle management: DRAFT → UPCOMING → ONGOING → RATING → FINISHED
- Jam browsing page with status filter and search
- Jam roles: Admin, Moderator, Judge, Host with granular permissions
- Join/leave jams during UPCOMING and ONGOING phases
- Game submissions with title, description, links, and contributors
- Rating system with custom criteria and Bayesian average scoring
- Results page with ranked submissions and per-criterion scores
- Jam management: edit details, manage members, moderate submissions
- In-memory rate limiting on server actions
- Responsive mobile-friendly UI with shadcn/ui and Tailwind CSS v4
- Docker production deployment (multi-stage build, PostgreSQL 16)
- Prisma schema migration service in docker-compose
