# Architecture

## Existing structure

The application stays at repository root; no artificial `src/` migration was performed.

```text
app/                    Next.js pages, layouts, and HTTP routes
  components/           Existing public-site components
  admin/                Reception workspace and patient directory
  super-admin/          Administrative workspace and patient directory
  doctor/               Doctor workspace
components/             Shared UI, layouts and patient directory
hooks/                  Existing client data/booking hooks
lib/
  appointments/         Field allowlists, state policy, transactional status service
  auth/                 Password/session/account lifecycle and registration policy
  permissions/          Existing five-role permission map
  security/             Origin checks, HTTP errors, rate limits, image validation
  validation/           Input schemas
prisma/                 Existing schema and unchanged migration history
scripts/                Operational checks, bootstrap, guarded seed utilities
tests/                 Unit and isolated mocked-handler regression tests
e2e/                   Public booking browser tests with intercepted APIs
docs/                  Implementation and handover documentation
```

## Request flow

Browser mutations pass same-origin checks in `proxy.ts`. API handlers then resolve the database-backed session and authorize a role or permission. Layouts also validate staff sessions; the proxy cookie-presence check is only an early redirect.

The session cookie contains a random token. PostgreSQL stores its SHA-256 digest and expiry. Logout and applicable account/profile changes revoke sessions. Password verification preserves scrypt and legacy bcrypt compatibility.

Reception appointment queries use `receptionAppointmentSelect`, which excludes clinical complaint fields, free-text notes and appointment notes at the database query boundary. Public doctor/service queries use separate allowlists. Patient APIs scope doctors both to assigned patients and their own appointments; knowing a patient ID is insufficient.

Appointment status changes live in `lib/appointments/service.ts`, using a row lock, doctor/day advisory lock, explicit transition policy, overlap checks on reactivation, and transactional audits. Creation routes recheck availability inside the transaction. Transfers and doctor status writes lock the appointment row. Relational workflows pass against isolated Prisma/PGlite; native multi-connection concurrency verification remains pending an isolated PostgreSQL environment; schedule edits and historical transfer durations still need coordinated workflow review.

## Data and external integrations

A module-level Prisma client and `pg` pool are reused. Availability derives from schedules, dated exceptions and non-cancelled appointments. Suggestions bulk-read the 31-day window in five queries. Doctor summaries and administrator overview use database grouping rather than loading full appointment histories.

Cloudinary uploads use the existing signed HTTP API implementation, not the removed unused SDK. These are public profile/service images; confidential documents require a separate private delivery design. Telegram sends check provider success and retain ownership checks on callback actions.

## Boundaries still to implement

No payment ledger, invoice, inventory, odontogram, private document, payroll or laboratory module is represented as complete. Their durable records and migration tests depend on a reviewed database expansion. OTP was explicitly declined. A typed phone confirmation must never be used as proof of identity for appointment history.
