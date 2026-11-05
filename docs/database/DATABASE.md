# Database

## Existing models and relationships

`User` optionally links one-to-one to `Doctor` and has `Session` records. Doctors have `DoctorSchedule`, `DoctorAvailabilityException` and `Appointment` records. `Patient` has appointments and `PatientNote` records. Each appointment references a service, optionally a patient and doctor, and has `AppointmentNote` entries. `SystemSetting`, `ClinicSetting`, `Review`, `AuthRateLimit` and `AuditLog` support the application.

The booking date convention is UTC midnight representing a clinic calendar date, with separate `HH:mm` local times. The clinic business timezone is `Asia/Ulaanbaatar`. These date-only values must not be treated as midnight UTC instants for local-day classification.

Patient phone is unique, but it is not a verified identity. Existing appointment contact snapshots remain unchanged when staff edit a patient's demographic record. Existing public bookings now preserve existing patient demographics. Name/phone snapshots submitted by public users are untrusted intake data.

## Read-only inspection on 2026-11-05

The configured PostgreSQL database was inspected in `BEGIN READ ONLY`; no mutation or migration was run. Observations:

- `_prisma_migrations` exists and contains all seven repository migrations, finished and not rolled back.
- 45 public indexes were reported.
- `Appointment_serviceId_fkey` uses `ON DELETE CASCADE`.
- Patient and doctor appointment foreign keys use `ON DELETE SET NULL`.
- Session/account state/rate-limit/audit tables and the current business columns exist.
- Eight accounts: two active SUPER_ADMIN, four active DOCTOR, one suspended DOCTOR, one active RECEPTION. No ADMIN or PATIENT accounts were reported.
- One warm `SELECT 1` took 87 ms. This is a single database round-trip, not API latency or a production percentile.

Earlier `docs/SECURITY_ROLLOUT.md` described a database without Prisma history. That historical observation is superseded for the database inspected here. It must not be used to infer that every environment has the same state.

## Changes in this branch

The initial increment made no schema changes. The subsequent approved role increment adds USER to the compatibility enum and supplies two forward-only role migrations; these were tested only in isolated PGlite and have not been applied to production. Service/doctor DELETE endpoints archive using existing `isActive` fields. Appointment DELETE cancels using the existing status field. The cascade constraint remains in the database, so direct SQL deletion is still dangerous.

## Forward migration work

Before writing or applying a migration:

1. Take a provider snapshot and verified restorable backup; secure backups as patient data.
2. Restore an isolated staging copy. Docker was unavailable in this session; production is the only configured database.
3. Compare actual columns/types/defaults, foreign keys, unique constraints and indexes with `schema.prisma`; compare applied migration checksums as well as names.
4. Generate reviewed forward-only SQL. Do not reset, replay applied migrations, or mark unknown migrations as applied.
5. Rehearse on the restored copy, assert record counts and historical values, exercise app queries, and document recovery.
6. Obtain production migration approval, then deploy in a controlled window.

Priorities are replacing the service cascade with RESTRICT, nullable historical price/name snapshots, doctor-service eligibility, and appropriate appointment overlap constraints. Unknown historical prices must remain unknown; current catalog prices cannot be represented as recovered historical prices. Snapshot new bookings and use staff-reviewed backfills where provenance exists.

Financial expansion should use Decimal monetary values and immutable invoice/payment/allocation/refund records with idempotency and transaction-level balance checks. Clinical/tooth history, private documents, inventory movements, commissions and payroll require their own reviewed relationships. No speculative duplicate models were added.

## Inspection commands

`bun run db:inspect` prints table/column names. `bun run db:inspect --audit` prints role counts, migration states, constraints, indexes and one warm ping. `--verify-security` checks security-table presence and account-state consistency. All run inside read-only transactions and never print credentials or patient rows.

The old `scripts/apply-security-upgrade.ts` entry point now refuses execution rather than referencing an absent migration or guessing a baseline.

## Approved role implementation

See ROLE_MIGRATION_PLAN.md for the implemented four-role normalization, two-stage migration, validated four-role CHECK and last-admin trigger, isolated rehearsal results, deployment ordering and recovery. The seven-migration production inventory above remains the last read-only observation; two new role migrations are pending.
