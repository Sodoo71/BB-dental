# Deployment and recovery

## Release status

This branch is not approved for production release. Compilation/build and local tests are necessary but insufficient: production credential rotation, configuration, staging migration rehearsal, real database integration tests and the remaining V2 modules are outstanding.

## Configuration

Use `.env.example` as the names/template; store values in the deployment provider's secret environment settings. Never commit or export them.

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | PostgreSQL runtime URL; use provider pooling where appropriate |
| DIRECT_URL | Optional migration connection; must target the intended same database |
| AUTH_SECRET | Required HMAC secret for shared rate-limit identities, at least 32 random characters |
| APP_URL | Exact browser origin; HTTPS in production, no trailing path/slash |
| CLOUDINARY_URL | Required for image upload; alternatively use existing CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET and CLOUDINARY_CLOUD_NAME support |
| TELEGRAM_BOT_TOKEN | Optional real Telegram integration token |
| TELEGRAM_CHAT_ID | Optional administrative delivery destination |
| TELEGRAM_WEBHOOK_SECRET | Required to accept Telegram webhook requests |
| TELEGRAM_WEBHOOK_BASE_URL | Optional HTTPS tunnel/origin for webhook setup; does not replace browser APP_URL |
| SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD | Local initial-admin command only; never browser-exposed |
| TEST_DATABASE_URL | Isolated disposable tests only; no production mutation tests |

`ADMIN_CHAT_ID` remains a legacy Telegram fallback. `CRON_SECRET` is retained for compatibility but does not imply a working scheduled-reminder job. No SMS/OTP integration is required after the user's explicit decision to use phone confirmation instead.

Run `bun run check:env` before deployment. It checks configuration without printing values. The local configuration inspected in this session was missing AUTH_SECRET. No production secrets were changed. The previously hardcoded database credential must be rotated with the provider; deleting it from source does not revoke it. Earlier security documentation also called for Telegram/Cloudinary credential rotation; verify provider-side completion.

The installed pg parser warns about future changes to `sslmode=require` semantics. Review the provider's trusted certificate requirements and use explicit verification for production; do not suppress the warning by disabling certificate verification.

## Build and deploy

1. Review and approve the release scope and unresolved issues in V2_PROGRESS.md.
2. Use `bun install --frozen-lockfile`, `bun run check:env`, typecheck, lint and tests.
3. Restore a backup into staging and reconcile migration names, checksums and schema. All seven migration names are recorded in the currently inspected database, but this is not proof of a clean baseline in every environment.
4. Rehearse any future forward migrations and verify recovery; get explicit approval before production database or role changes.
5. Build with `bun run build`. A configured DATABASE_URL is currently needed during route-module loading. A successful build does not establish connectivity, provider delivery or valid secrets.
6. Deploy to the existing Vercel environment only after approval. Preserve Datacom/DNS configuration; it was not inspected or changed here.
7. Verify login for administrators/reception/doctors, field privacy, real availability, conflict handling, history retention, profile synchronization, image uploads and confirmed Telegram delivery.

`db:deploy` is not a blanket authorization to replay migrations against the only production database. Do not run `migrate reset`, demo seeds, unsafe `db push`, or the disabled legacy security rollout.

## Initialization

Use `bun scripts/bootstrap-admin.ts` only for an intentionally new database. It refuses to reset an existing administrator. Existing clinics should use authenticated account administration.

`bun run db:seed` is a development/demo tool. It requires NODE_ENV=development, ALLOW_DEVELOPMENT_SEED=true, an explicit DATABASE_URL, an exact matching SEED_DATABASE_NAME with a dev/test name segment, and explicit strong passwords. It is not a repeatable production initializer and still inserts demo bookings. Existing accounts are not reset on rerun.

## Backup and recovery

Use provider snapshots plus a verified database backup and an isolated restore rehearsal. The application's JSON export is not a complete relational backup and cannot replace those procedures. Protect backups as confidential clinic data.

For a code rollback, redeploy the reviewed prior Git revision without resetting the database. For future schema changes, prefer forward repair; determine restore/backfill consequences before deployment and document operator steps. No database migration or role conversion was performed in this branch, so no database rollback is required for these code changes.
