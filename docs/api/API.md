# API contracts

The App Router API surface is preserved. Browser mutations require matching Origin checks in `proxy.ts`. Staff endpoints also require an active unexpired database session; hiding UI controls is not authorization.

## Conventions

New and remediated handlers return `{ success: true, data }` for reads/changes and `{ error }` for errors. Existing endpoints may retain earlier response shapes. Validation errors use 400, forbidden calls 403, unknown/out-of-scope resources 404, conflicts/duplicates 409, rate limits 429, unexpected failures 500. Internal Prisma errors and connection details are not returned by the remediated handlers.

## Public routes

| Route | Contract |
| --- | --- |
| GET `/api/clinic` | Public clinic settings |
| GET `/api/doctors` | Active public profile fields only; excludes private contacts and Telegram IDs |
| GET `/api/services` | Active catalog; `all=true` requires ADMIN/SUPER_ADMIN |
| GET `/api/availability?doctorId=&serviceId=&date=YYYY-MM-DD` | Database-backed available slots |
| GET `/api/availability/suggest?doctorId=&serviceId=` | Up to six suggestions in the next 31 clinic days |
| POST `/api/appointments` | Validated booking intake; requires `phoneConfirmed: true`; public response includes only confirmation ID/date/time/status/doctor/service IDs |
| POST `/api/booking` | Existing retired entry point returns 410 and directs callers to appointments |
| POST `/api/auth/register` | DOCTOR/RECEPTION enrollment; only doctors may use doctor auto-approval |
| POST `/api/auth/login` | Rate-limited email/password login with opaque session cookie |

Booking intake retains `fullName`, `phone`, optional `age`, `gender`, `chiefComplaint`, plus `doctorId`, `serviceId`, `appointmentDate`, `startTime`. `phoneConfirmed` is a typing confirmation, not identity verification. Existing patient demographics are never overwritten through this route. Booking rate limits are five attempts per normalized phone and 200 clinic-wide per 15 minutes. These are abuse limits, not ownership proof.

No public phone-based appointment-history endpoint is exposed.

## Appointments

ADMIN/SUPER_ADMIN/RECEPTION may GET/POST `/api/admin/appointments` and PATCH/DELETE `/api/admin/appointments/[id]`. Reception responses omit `note`, `chiefComplaint` and `notes`, including mutation responses. The legacy list is not yet paginated; clients depending on the full response remain compatible. Its pagination/client-filter migration is pending.

Status PATCH accepts `{ status }`. PENDING may confirm/cancel, CONFIRMED may complete/cancel/no-show, and CANCELLED may reopen only after a locked availability check. COMPLETED/NO_SHOW cannot reopen. Same-status retries are idempotent. Legacy DELETE now cancels pending/confirmed appointments and retains history; terminal appointments return a conflict rather than disappearing.

Doctor endpoints `/api/doctor/appointments` and `/api/doctor/appointments/[id]` retain personal scoping. Notes `/api/appointments/[id]/notes` and transfer `/api/appointments/[id]/transfer` require clinical/staff authorization and doctor ownership when appropriate. Reception cannot read notes or transfer through these clinical endpoints.

## Patients

| Route | Roles | Contract |
| --- | --- | --- |
| GET `/api/patients?page=1&search=` | ADMIN/SUPER_ADMIN/RECEPTION; assigned scope for DOCTOR | 50 demographics per page; `{ pagination: { page, pageSize, total } }` |
| POST `/api/patients` | ADMIN/SUPER_ADMIN/RECEPTION | Creates a patient; existing phone returns 409 instead of overwriting |
| GET `/api/patients/[id]?page=1` | Same readers with ownership | Demographics plus 50 appointments, doctor/service and permitted notes; doctors see only their own visits |
| GET `/api/patients/[id]?summary=true` | Same readers with ownership | Demographics only, for repeat-booking prefill |
| PATCH `/api/patients/[id]` | ADMIN/SUPER_ADMIN/RECEPTION | Partial demographic update; transactional audit, no historical appointment snapshot rewrite |

Patient input: `fullName` (2–120 chars), `phone` (8–15 digits with optional leading +; formatting stripped), optional nullable `email`, `age` (0–150), `gender` (MALE/FEMALE/OTHER). This branch does not merge international/local phone aliases or rewrite existing records.

## Profiles and catalog

`/api/doctor/profile` and legacy `/api/doctors/profile` share GET/PUT implementation. Updates accept permitted profile fields, synchronize login/profile records atomically, and revoke sessions on email change. Legacy `telegramId` is accepted as an alias for `telegramChatId`.

Service POST/PUT/DELETE requires ADMIN/SUPER_ADMIN. Price must be a nonnegative PostgreSQL Int; Decimal accounting values remain future migration work. DELETE archives `isActive=false` and audits the change. Doctor DELETE similarly deactivates the profile, suspends a linked account if permitted, revokes its sessions and retains history.

## Other preserved endpoint families

- `/api/admin/users`, `/approve`, `/reset-password`: account administration with equal-administrator, self-management and last-active-administrator protection.
- `/api/admin/doctors`, `/[id]/schedule`, `/[id]/availability`: doctor administration and availability.
- `/api/admin/doctor-leaves`, `/api/doctor/availability`, `/api/doctor/exceptions`: schedule and leave workflows.
- `/api/super-admin/overview`, `/doctors`, `/doctors/[id]`: operational analytics and doctor detail.
- `/api/super-admin/settings`, `/logs`, `/system/diagnostics`: settings, audits and privileged diagnostics/export.
- `/api/upload`: authenticated raster profile/service images, 8 MB limit, content-signature checks; not confidential documents.
- `/api/telegram/*`: delivery checks, setup, tests, doctor reminders and secret-authenticated webhook.

Administrator overview retains legacy monetary keys for compatibility and adds `financialReporting.basis = CURRENT_CATALOG_ESTIMATE`. Payment/expense/recognized-revenue fields are null because corresponding transaction models are absent. Consumers must not label legacy estimates as collected revenue or profit.

## Approved role compatibility increment

Authorization, login, session and account-list responses expose ADMIN/DOCTOR/RECEPTION/USER. Legacy SUPER_ADMIN/PATIENT rows normalize to ADMIN/USER during rollout. New role assignments reject legacy values. `/super-admin` URLs remain stable. The database expansion/backfill/CHECK/trigger migrations are implemented but not run against production; see database/ROLE_MIGRATION_PLAN.md for ordering.
