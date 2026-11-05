# Changelog

## 2026-11-05 — V2 security and core-workflow increment (not a complete V2 release)

- Established feature/bb-dental-v2 from 29be91d; preserved the subsequent user switch to bb-dental-v2; preserved the user's npm lockfile patch.
- Removed hardcoded database credentials and insecure TLS overrides from demo seed; added explicit development guards and stopped existing-account password resets.
- Filtered reception clinical fields and public doctor/service fields server-side.
- Preserved existing patient demographics during public bookings; added rate limits and phone typing confirmation without OTP, per user direction.
- Added locked appointment status transitions/reactivation validation and history-preserving cancellation/archive behavior.
- Added patient registration, paginated search, staff editing, scoped history and repeat-booking prefill using existing models.
- Consolidated legacy/current doctor profile endpoints and synchronized profile/account edits atomically with session revocation on email change.
- Replaced repeated availability scanning and doctor/dashboard history loading with bulk queries and database aggregation; standardized administrator clinic-date boundaries.
- Relabeled catalog monetary estimates and added explicit reporting-basis metadata; no actual payment/revenue reporting is claimed.
- Removed five verified unused dependencies, unused imports and duplicate legacy profile implementation; retained public route compatibility and migration history.
- Replaced the broken legacy security migration command with an explanatory refusal, and added read-only database audit/configuration checks.
- Added isolated Prisma/PGlite relational workflow tests, policy/API/seed regression checks and updated browser tests for required phone confirmation.
- Added architecture, API, database, role-migration, development, deployment and progress handover documents.

No schema migrations, role conversion, production writes, production secrets or deployments were performed. Financial, inventory, odontogram, private document, payroll and laboratory expansion remain pending.
