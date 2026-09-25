# BB Dental ERP implementation plan

## Existing project audit (24 September 2026)

Next.js 16.3.2 App Router, React 19, strict TypeScript, Tailwind 4, Prisma 7 with PostgreSQL adapter. Existing public booking, doctor schedules/exceptions, appointment notes, doctor/reception/admin dashboards, services CRUD, registration and user management, Cloudinary upload and Telegram callbacks. Existing working tree contains extensive user changes; preserve them.

Environment names inspected without reading values: DATABASE_URL, PORT, TELEGRAM_BOT_TOKEN, ADMIN_CHAT_ID, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, AUTH_SECRET, CLOUDINARY_URL. Configuration presence does not prove external connectivity.

Baseline TypeScript check passes. No existing automated business-rule suite. Current appointment creation uses a per-doctor/day advisory lock, but update paths and schedule changes need unified enforcement. Existing schemas use separate date/time fields; preserve data while migrating incrementally.

## Findings and sequence

1. Security foundation: opaque database sessions, server expiry/revocation, password-format compatibility, distributed authentication throttling, same-origin mutation protection, explicit staff account states, reception role, permission policy, transactional approval and audit records. Remove secret-bearing responses and browser credentials. Preserve SUPER_ADMIN as a privileged legacy administrator and PATIENT as a legacy role with no staff permissions.
2. Patient/doctor/service models: full demographics, allergies/emergency contacts, assigned-patient authorization, configurable weekly breaks and clinic hours, paginated queries.
3. Appointment service: one transactional create/reschedule/status workflow, price/duration snapshots, clinic timezone, PostgreSQL exclusion constraint, concurrency and boundary tests.
4. Role dashboards and mode navigation: real aggregate queries, reception checkout/follow-up, administrator acting as a doctor only through an assigned doctor profile.
5. Medical records: treatment entities, private Cloudinary assets and authorized signed delivery; never store base64 file contents in PostgreSQL.
6. Transfer state machine and patient-specific chat with membership/access checks, read markers and polling/realtime updates.
7. Durable notification outbox, privacy-minimized Telegram messages and authenticated deep links.
8. CMS and analytics: clinic/service/doctor management, actual paid revenue (current service price is not historic revenue).
9. Integration/concurrency tests, responsive/browser QA, deployment validation and retention/backup procedures.

## Migration and rollout

Security migration is additive: new account state, reception enum, sessions, rate-limit buckets and audit log. Existing active users become ACTIVE; inactive users become PENDING because the old schema cannot distinguish pending from suspended. Review inactive legacy accounts before rollout. Old signed-ID cookies become invalid, requiring everyone to log in again. No patient/appointment rows are deleted. Apply migration before starting the new server. Never run the existing demo seed against a live database.

A Telegram token was embedded in existing browser/server source. Rotate it through BotFather and replace TELEGRAM_BOT_TOKEN in deployment secrets; removing source references cannot revoke an exposed credential or erase repository history.

## Acceptance tracking

Do not treat implemented source as verified production functionality. Track checks and remaining work in the implementation report. Database integration requires an isolated test database; no production test fixtures or destructive resets.
