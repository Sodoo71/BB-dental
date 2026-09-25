# Security foundation rollout

## Existing database

Read-only inspection confirmed existing business tables but no `_prisma_migrations` table. Historical migrations also do not describe all existing columns. Do not use `prisma migrate deploy`, `migrate reset`, `db push`, or mark historical migrations as applied without reconciling that drift.

The reviewed `scripts/apply-security-upgrade.ts` applies only the new additive SQL in one transaction with lock/statement timeouts. It refuses to run if the account-state column already exists. It does not replay old migrations, delete patients/appointments, or silently baseline unknown changes. The new Prisma migration also describes that upgrade for databases with a reconciled history.

Before a future fresh installation, generate and review a complete baseline of the current schema, including constraints, rather than relying on the old migration chain. This remains rollout work.

## Configuration

- Set `APP_URL` to the exact public origin, including scheme and port if applicable. Production API access fails closed without it. Browser mutations require a matching Origin; machine API clients must send it too.
- Keep `AUTH_SECRET` configured; authentication rate-limit identities are HMAC-digested with it.
- Rotate the exposed Telegram bot token and Cloudinary API secret; replace deployment environment credentials. Source removal does not revoke credentials.
- Set `TELEGRAM_WEBHOOK_SECRET` and configure the same secret token when registering the webhook. Unauthenticated webhook requests now fail closed. Doctor-ID-only Telegram linking was removed; administrators assign the verified chat ID through staff management.
- Public uploads accept JPEG/PNG/WebP with signature checks and an 8 MB limit. Configure an 8 MB plus multipart-overhead body limit at the reverse proxy as well. The current upload route is for public profile/service media, not medical records.
- Old session cookies are invalid. All users must sign in again. Sessions expire after 12 hours; logout removes the server session; staff edits and password reset revoke every session for that user.
- Initial admin provisioning: `bun scripts/bootstrap-admin.ts`. Uses SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD and refuses to reset an existing administrator. Do not run the legacy demo seed on a real clinic database.

## Maintenance

Schedule deletion of expired Session and AuthRateLimit rows. Rate-limit counters are shared by all application instances. Add trusted edge/IP throttling for public authentication and request-size enforcement; arbitrary forwarded headers must not be trusted as client identity. Current login limit is 8 attempts per normalized email per 15 minutes. Registration has per-email and clinic-wide limits.

Audit logging currently covers staff creation/approval/state changes, password resets, settings changes and profile uploads. The remaining appointment, medical, and transfer workflows still need transactional audit coverage. Database access for the application should not permit modifying audit history outside the intended service.

## Unfinished ERP acceptance work

Patient medical records/private files; patient transfer state machine; internal chat/read state; clinic hours/weekly breaks; unified appointment create/reschedule locking and DB exclusion constraints; checkout/payment snapshots; durable notifications; full analytics validation; accessible modal and mobile QA; isolated database integration/concurrency tests. The security increment is not a claim that the complete ERP is production-ready.
