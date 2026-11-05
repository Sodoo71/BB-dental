# BB DENTAL

An existing dental-clinic booking and staff-management application being upgraded incrementally to V2. The current branch contains security remediation, safer appointment history, patient management, and query improvements. Clinical ERP, accounting and inventory are **not complete**. The approved four-role migration is implemented for isolated/staging verification and remains unapplied to production.

## Stack and package manager

Next.js 16.3.2 App Router, React 19.2.8, TypeScript, Prisma 7.9.1, PostgreSQL through `@prisma/adapter-pg`, Tailwind CSS 4, Cloudinary HTTP uploads, and Telegram HTTP integrations.

Use **Bun 1.3.14** and `bun.lock` as the authoritative dependency resolution. `package-lock.json` was already modified by the user before this work and is preserved; do not use it to install or regenerate dependencies for this branch. No framework or database provider was replaced.

## Setup

1. Copy `.env.example` to `.env` and provide your own configuration. Never commit `.env`.
2. Set `DATABASE_URL`, `AUTH_SECRET` (at least 32 random characters), and the exact browser origin in `APP_URL`. Generate a secret with `openssl rand -hex 32`; put it in the local environment without sharing it in chat or logs.
3. Run `bun install --frozen-lockfile` and `bun run check:env`.
4. Run `bun run dev` and open `http://localhost:3000`.

Installation generates Prisma Client. It does not apply migrations. Existing database history must be reconciled before any migration command. Never run demo seeds or mutation tests against the clinic database.

Cloudinary configuration is required for image uploads. Telegram configuration is optional for booking but required for real notifications. See [deployment](docs/deployment/DEPLOYMENT.md).

## Commands

```sh
bun run dev
bun run check:env
bun run typecheck
bun run lint
bun test tests
bun run test:database
bun run test:roles
bun run build
bun run start
bun run test:e2e
bun run db:inspect
bun run db:inspect --audit
```

Playwright expects a separately running server at `http://localhost:3000`, or `PLAYWRIGHT_BASE_URL`. The current browser suite intercepts clinic APIs and does not verify live database workflows.

`bun run db:deploy` remains the existing Prisma deployment entry point. **Do not execute it against production without the database review, backup, staging rehearsal, and approval described in the deployment guide.**

## Current features

- Public homepage, doctor/service browsing, real availability and booking.
- Phone-number confirmation before booking, without OTP, as requested. Confirmation does not prove ownership; public appointment lookup is not exposed.
- Reception appointment operations at `/admin`; patient registration/editing/history at `/admin/patients`.
- Administrative management at `/super-admin`, including `/super-admin/patients`.
- Doctor dashboard, personal appointments, calendar, patient summaries, profile, schedules, and exceptions at `/doctor`.
- Account approval, expiring/revocable sessions, shared database-backed rate limits, audit logs, Cloudinary profile images, and Telegram controls.

The application uses ADMIN, DOCTOR, RECEPTION and USER, with legacy stored-role read compatibility. The approved database conversion remains pending production rollout. Dashboard monetary figures are current-catalog estimates, not recorded collections, recognized revenue, or profit.

## Handover

- [Progress, limitations and verification](docs/V2_PROGRESS.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Database and migration plan](docs/database/DATABASE.md)
- [Role migration proposal](docs/database/ROLE_MIGRATION_PLAN.md)
- [API contracts](docs/api/API.md)
- [Development conventions](docs/development/DEVELOPMENT.md)
- [Deployment and recovery](docs/deployment/DEPLOYMENT.md)
- [Changelog](docs/CHANGELOG.md)
