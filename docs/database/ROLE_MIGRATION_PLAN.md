# Four-role migration — implementation approved, production pending

On 2026-11-05 the user approved the mapping for implementation and staging tests. This does not authorize production conversion or deployment. The code and two forward-only migrations are implemented and rehearsed in isolated PGlite; no production migration was run.

## Approved mapping

| Persisted V1 role | Primary V2 role |
| --- | --- |
| SUPER_ADMIN | ADMIN |
| ADMIN | ADMIN |
| DOCTOR | DOCTOR |
| RECEPTION | RECEPTION |
| PATIENT | USER |

The two previously inventoried active SUPER_ADMIN accounts become equal administrators. The application normalizes legacy reads before authorization, emits canonical roles on login/session/account responses, and permits only ADMIN/DOCTOR/RECEPTION/USER in new assignment validation and UI. Public registration still permits only doctor/reception enrollment subject to approval rules. USER has no internal permissions.

Read-only production inventory from the prior increment: two active SUPER_ADMIN accounts, four active and one suspended DOCTOR account, one active RECEPTION account, no ADMIN/PATIENT accounts. Recheck the inventory before deployment; it is not a live guarantee.

## Compatibility and storage design

`lib/roles.ts` defines exactly four primary roles. `StoredRole` and the Prisma enum retain the two deprecated labels solely to decode pre-conversion rows during rollout. This avoids dropping/recreating a PostgreSQL enum and avoids breaking legacy rows before the backfill. Retaining decoder labels does not allow assigning additional primary roles.

The conversion migration adds a validated CHECK allowing only the four primary values on User rows. After conversion, new SUPER_ADMIN/PATIENT writes fail at the database boundary. Physical retirement of unused enum labels is intentionally deferred; it is unnecessary for the four-role access model and would require a separate enum replacement/recovery review.

Existing `/super-admin` URLs and SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD operator environment variable names remain for compatibility. They create or represent ADMIN, not another primary role.

## Migration artifacts

1. `prisma/migrations/20261105000100_expand_user_role/migration.sql` adds USER. It is separate because PostgreSQL must commit a new enum value before using it.
2. `prisma/migrations/20261105000200_map_four_primary_roles/migration.sql` takes the user-administration advisory lock and a User table lock, checks an active administrator exists for a populated database, audits legacy role mappings, changes only the role column, validates the four-value CHECK, and installs last-active-admin protection. It runs atomically with timeouts.

The migration preserves identifiers, password hashes, account states, doctor links, sessions and existing timestamps. Migration audits contain only entity IDs and before/after roles. There is no password reset, session deletion or patient-data transformation.

## Administrator safeguards

All account mutations share `lockUserAdministration`, which rechecks active administrator access and accepts canonical/legacy equivalent roles. `preserveActiveAdministrator` checks the proposed change before role/status/activity mutations, including linked-doctor deactivation. Existing self-management restrictions remain.

A PostgreSQL row trigger additionally refuses direct SQL updates/deletion that would remove the last active ADMIN. The trigger uses the same advisory lock. Native PostgreSQL concurrency tests remain necessary to verify all interleavings; PGlite's single-connection execution is not evidence of concurrent native behavior.

## Deployment sequence — requires separate production approval

Do not run both migrations automatically against the only production database merely because these files exist.

1. Verify a restorable backup and restore an isolated native PostgreSQL staging copy. Recheck migration history, constraints, role counts and administrator credentials.
2. Rehearse the two stages and recovery on that copy. Confirm both original administrators can log in and no clinical/public permission expands unexpectedly.
3. Prepare an expansion-only release, commit the USER enum expansion, and deploy the compatibility application to every instance before converting rows or allowing USER assignment. Older generated Prisma clients cannot safely decode newly written USER values.
4. After every instance runs the bridge, release the conversion migration with explicit production approval. A maintenance window is appropriate if instance sequencing cannot be guaranteed.
5. Verify canonical roles, sessions, account management, last-admin protection and audit entries. Keep legacy labels in the enum until any later physical-retirement review.

The existing `db:deploy` applies all pending migration directories. It cannot be used as an expansion-only command with this full checkout. Release packaging/targeted migration recording must be reviewed in staging; no automatic production rollout script is supplied.

## Verification

`bun run test:roles` builds an isolated legacy schema from Git revision 3335f04, seeds synthetic legacy accounts, and executes the actual SQL files. It verifies canonical login and preserved administrator sessions, row/credential/link/timestamp preservation, PATIENT → USER, role-migration audits, rejected legacy writes, equal-admin changes, self-management denial, last-admin update/delete refusal, and rollback when no active administrator exists. It never uses the production URL.

Typecheck, lint, unit/regression tests, the existing relational suite and production build are also checked. Native staging, native concurrent mutation tests, provider credential rotation, missing AUTH_SECRET configuration and production execution remain pending.

## Recovery

Before conversion, application rollback can read the original role values. After conversion, do not roll back to a V1 generated client: USER may be undecodable and equal-admin policy differs. Prefer the compatibility build as the rollback release, keeping the data mapped. The conversion is transactional; if it fails, investigate and forward-repair rather than resetting the database. Enum expansion remains harmless if conversion fails. Any data/enum reversal requires a reviewed backup/recovery procedure and separate approval.

Phone typing confirmation is not account ownership verification. USER appointment history, cancellation and rescheduling remain unavailable until a secure ownership design is approved; OTP was explicitly declined.
