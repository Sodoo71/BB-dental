# Reception implementation and verification

## Scope and audit

The existing application uses Next.js 16.4.5 App Router, React 19, TypeScript, Prisma 7 with the PostgreSQL adapter, Zod, Lucide, and the existing ERP component library. Authentication uses hashed session tokens in an HttpOnly cookie; roles are ADMIN, DOCTOR and RECEPTION. There is no separate Super Admin role in the schema.

Before implementation, Reception shared the generic workspace, exposed clinical patient history and notes, could write patient notes, had no dedicated operational queue or billing invoices, and recorded standalone payments without cash-session reconciliation. Existing scheduling already checks service eligibility, working schedules, approved leave/blocked ranges, duration, existing bookings and current clinic time on the server, using doctor advisory locks for booking/rescheduling.

This work preserves existing uncommitted changes. Doctor and Admin screens retain their existing workspace and navigation. New workflow restrictions apply to Reception. New reception settlements are immutable at database level, including when accessed through legacy endpoints.

## Features and changed files

- `app/erp/reception.tsx`, `app/erp/reception.css`: dedicated Reception workspace with all ten requested navigation destinations; database-driven dashboard; patient registration/edit/profile/history/alerts/archive; availability-backed appointments and follow-ups; check-in confirmation; walk-ins; queue numbers, arrival times, waiting duration and guarded transitions; invoice drafts and line removal; finalized invoice collection; partial/split payments; receipts and print styles; cashier shifts/withdrawals/discrepancies; transactions and refund requests; receivables and overdue filtering; operational notifications and reports/CSV exports.
- `app/erp/shell.tsx`: Reception-specific navigation uses the existing responsive, collapsible shell. Reception global search goes to patients.
- `app/erp/workspace.tsx`: routes Reception to the new workspace; exposes existing appointment/calendar components for reuse. Optional Reception calendar styling identifies doctors and shows start/end times.
- `app/erp/[[...section]]/page.tsx`: recognizes the added destinations. Other roles cannot access their data through the Reception APIs.
- `app/api/export/[kind]/route.ts`: blocks Reception from exporting unrestricted clinical patient/document PDFs; Reception uses its scoped receipt and CSV flows.
- `app/api/reception/[resource]/route.ts`, `lib/reception.ts`, `lib/reception-domain.ts`: Reception-only data/actions, financial validation, transactions, locks, shift ownership and audit logging.
- `app/api/erp/[...path]/route.ts`: limits Reception to needed legacy patient/booking endpoints; returns demographics and authorized alerts without clinical history, notes or treatments; preserves clinical fields on demographic edits; blocks direct legacy payment creation and deletion; guards appointment transitions and rescheduling after check-in.
- `tests/reception-domain.test.ts`, `scripts/test-reception.mjs`, `scripts/test-reception-browser.mjs`: calculation/validation tests, isolated relational tests, and real browser/API checks.

## Database changes

Migration: `prisma/migrations/202611070003_reception/migration.sql`.

Adds Invoice, InvoiceItem, QueueEntry, CashSession, CashWithdrawal and RefundRequest. Extends existing Payment with optional invoice/session links and an external settlement reference. Existing Patient, Appointment and Treatment models gain inverse relations; no duplicate patient, appointment or payment ledgers are created.

Historical treatments are preserved as invoice lines. Existing payments retain their IDs, values, dates and methods and are linked to one explicitly identified legacy invoice per patient. Historical deposits exceeding charges appear as credit rather than negative receivables. Historical credits are displayed; they are not silently applied to new invoices. Legacy invoices are reconciliations of historical patient balances, not historical appointment-level invoices. Legacy billed amounts retain their original treatment dates in reports; the migration does not create migration-day billed revenue.

Constraints enforce one open cashier shift per receptionist, unique daily queue numbers, unique treatment billing links, positive monetary inputs and valid queue states. A trigger prevents modifying/deleting newly recorded reception settlements. Draft invoice lines can be removed before finalization. New financial mutations and their audits commit together.

The migration has been applied only to ephemeral test databases. It has **not** been applied to the configured clinic database. Deployment requires applying the additive migration before serving the new Reception code. No database reset or production data deletion was performed.

## API and security behavior

Reception data: `GET /api/reception/{dashboard,reports,queue,invoices,invoice,unbilled,cash-sessions,transactions,receivables,notifications}`.

Reception actions: `POST /api/reception/{check-in,queue-status,invoice-create,invoice-remove-item,invoice-finalize,collect,cash-open,cash-close,cash-withdraw,refund-request,patient-archive,notifications-read}`.

Every route enforces the role on the server; mutations enforce same-origin checks and Zod validation. Patient profiles omit clinical notes, diagnoses, treatment narratives and medical history. Authorized allergy alerts are read-only for Reception. Cashier operations lock the receptionist/session; collections also lock the invoice and external reference. Split allocations must equal the requested amount. Collection retries match the original payload and return the recorded transactions. Overpayment, duplicate references and reused keys with changed payloads are rejected. Cash balances exclude all noncash methods. Refund requests reserve the requested refundable amount but neither move money nor change the original payment.

Queue, appointment and payment states remain separate. Check-in records ARRIVED and a timestamped queue entry; queue completion does not silently complete an appointment or settle an invoice. Cancellation is confirmed in the UI; financial deletion is unavailable. CSV exports escape formulas. API responses use the existing no-store handling.

Notifications reuse AuditLog plus live pending bookings, follow-ups and due balances. Per-receptionist read cursors reuse Setting. Doctor arrival messages use the existing Telegram delivery function without exposing patient clinical details. Operational screens poll while visible every 30 seconds.

## Verification results

- `node --import tsx --test tests/*.test.ts`: **23 tests passed**. Used the direct Node loader because the tsx CLI's IPC listener was blocked in the sandbox.
- `bun scripts/test-reception.mjs`: **19 isolated checks passed**. Includes migration backfill, duplicate patient phones, server double-booking rejection, check-in idempotency, walk-ins, queue transitions, finalized billing, partial/split/full payments, retry protection, overpayment and missing-reference rejection, immutable financial history, refund permissions/limits, cash reconciliation and audits. PGlite exercises PostgreSQL semantics with the real Prisma client but does not prove native PostgreSQL concurrency behavior. Prisma emits a pg overlapping-query deprecation warning during relation loading.
- `bun scripts/test-reception-browser.mjs`: real production server, temporary database, real session cookies and Chromium. Checks all ten destinations, protected APIs, clinical confidentiality, demographic edits, appointment API creation/rescheduling/double-booking, registration UI, check-in UI, queue transitions, cashier opening, partial payment receipts, mobile navigation/dark theme/overflow, and existing Doctor/Admin dashboards. **11 browser/API verification groups passed**, including legacy PDF privacy bypass prevention.
- `bun scripts/test-v2-workflows.mjs`: **passed** existing isolated scheduling, role authorization, leave workflow, booking-contact, export and account regression checks.
- `bunx tsc --noEmit`: **passed**.
- `bun run lint`: **passed**, with three pre-existing unused-variable warnings in the legacy ERP route and Telegram webhook.
- `bun run build:next`: **passed**.
- `bun run build`: **passed**, including the Cloudflare/OpenNext worker bundle. Existing static prerender handling logs a generic ERP request failure without failing the build; the bundled Excel dependency emits a duplicate-key warning.

No live bank, QPay, card terminal, Telegram delivery, production migration or deployment was exercised. Existing legacy `e2e/erp.spec.ts` payment/document expectations predate the new Reception restrictions; the new isolated browser runner verifies the replacement workflows. The complete legacy Playwright suite was not executed.

## Remaining production limitations

1. **Payment gateways:** no gateway integration exists. CASH records received cash; QPay/card/transfer entries are explicitly manually reconciled external settlements requiring a real reference and staff confirmation. No gateway success is fabricated.
2. **Refund execution:** Reception can request a refund; it cannot approve or execute one. Requests remain REQUESTED. An authorized approval/disbursement workflow and append-only refund settlement ledger must be integrated before issuing actual refunds from this module. Reports distinguish requests and legacy voids from collected payments; they do not claim requested refunds were issued.
3. **Clinic-wide operating policy:** only human-readable clinic hours currently exist. Availability enforces the existing machine-readable doctor schedules and approved unavailable/break intervals. An additional clinic-wide hours/break policy cannot be reliably inferred from display text and is not implemented.
4. **Notifications:** audit events are operational summaries, not a persisted delivery outbox. Public pending bookings and follow-ups are read from live records; externally confirmed bookings and doctor-originated changes are only as detailed as their existing audit events. Delivery retry guarantees and all-clinic live push notifications are not implemented.
5. **Scale and concurrency:** receivables/report aggregates currently read matching records before pagination/filter aggregation. Large historical ledgers need database-level aggregation. Native PostgreSQL concurrent load testing and live external integration tests remain outstanding.
6. **Policy:** Reception discounts are disabled because there is no existing discount approval policy. Existing historical credits are visible but require an authorized adjustment workflow to transfer to another invoice.

These limits mean the requested production-readiness definition is not fully met, despite the implemented and verified core Reception workflows.

## Follow-up: appointment selection and phone bookings (2026-11-08)

At the user's request, the shared Admin/Reception appointment form now supports manual start-time entry for phone bookings. Staff may enter non-grid times such as 09:10; server checks still enforce service eligibility, duration, current time, working intervals, approved leave/breaks and booking conflicts while holding the doctor lock. Public booking suggestions retain their existing 15-minute grid. Staff rescheduling uses the same manual-time validation.

Time selection is now controlled by the appointment form and cleared when the doctor, service or date changes, preventing stale form values from disagreeing with the displayed slot. New-patient submissions omit an empty patient ID, fixing the invalid-UUID failure when no existing patient was selected.

Changed: `app/erp/workspace.tsx`, `app/erp/erp.css`, `lib/available-times.ts`, `lib/booking.ts`, the existing ERP reschedule handler, and the scheduling/browser tests. No database changes were needed for this follow-up.

Verification: 24 unit tests passed; 14 browser/API verification groups passed against the isolated database, including real time-select submission and an Admin phone booking at 09:10; existing isolated workflow regressions passed; TypeScript and Next.js production build passed. Lint passed with the same three pre-existing warnings.

## Follow-up: all shared dropdown values reset (2026-11-08)

Reproduced the reported failure in the shared EntityForm: its bubbling `onInput` validator updated React state between a native select's `input` and `change` events. That rerender restored the old controlled value before the select's change handler could read the new value. The previous appointment-specific fixes did not resolve this shared cause. A regression test failed before this correction (`'' !== 'FEMALE'`).

Moved error clearing to `onChange`, after the field consumes its value, and skip error-state updates when no error exists. Generic select and patient-picker controls also capture their value immediately on native `input`, so a pending modal rerender cannot restore the old selection before `change`. Shared field updates now use functional state setters so a field edit or async image callback cannot overwrite other selected values.

Verification: `node scripts/test-form-selects.mjs` checks six shared dropdown types (gender, doctor, service, method, status and patient) across separated native input/change events, subsequent text edits, submitted payloads, reopen, and required-field error correction, at 1440px and 390px. The real isolated application/browser suite also verifies that a similarly selected patient gender persists as FEMALE in PostgreSQL. All 15 browser/API groups passed, including create, edit, save and reopen with database assertions; 24 unit tests, TypeScript, lint and the Next.js production build passed. Lint retains its three existing warnings. No database migration is required for this fix.

Native popup keyboard automation on the current headless macOS Chromium did not change even a plain HTML select. Dropdown regression checks therefore explicitly separate native input/change events across animation frames; OS popup keyboard navigation is not claimed as verified.

## Follow-up: integrate bb-dental-v2 special-time behavior (2026-11-08)

Inspected `bb-dental-v2` at `e264be7`, specifically the quick-book `forceBooking` toggle in `app/admin/page.tsx` and the `force` handling in `app/api/admin/appointments/route.ts`. Integrated its special-time behavior into the existing **Утсаар авсан захиалга — цагийг гараар оруулах** checkbox in the current working branch without switching branches or replacing the other branch's architecture.

For Admin, selecting this checkbox now sends an explicit `force` flag. The server permits Admin to override normal working intervals, an absent roster, and approved leave for that individual booking or reschedule. It retains active doctor/service checks, service eligibility, future-time checks, full appointment duration, same-day end bounds and overlap protection under the doctor advisory lock. Overrides are recorded atomically as `APPOINTMENT_SCHEDULE_OVERRIDE` audit events. The weekly schedule and leave records are not rewritten.

Reception retains ordinary manual-minute entry within bookable intervals. Forged Reception override flags are rejected with 403. Public booking has no override authority and ignores the staff-only flag. Admin's ordinary slot mode still enforces the normal schedule. The existing checkbox label is retained; Admin help text explains its special-time behavior.

Changed: `lib/booking.ts`, the existing ERP appointment/reschedule handlers, the shared AppointmentForm, and the isolated browser/API runner. No schema/migration changes. Existing uncommitted work is preserved.

Verification: **17 browser/API groups passed**, including Admin UI booking at 19:10 outside a 09:00–18:00 schedule, override authorization, missing roster, approved day off, inactive doctor rejection, overlap and overnight rejection, public bypass prevention, rescheduling and audit checks. **24 unit tests passed**; existing isolated workflow regressions, TypeScript, lint and Next.js production build passed. Lint retains the existing three warnings. Production data and deployment were not changed.


## Follow-up: Reception special-time access and immediate dismissal (2026-11-08)

The user's explicit update supersedes the earlier Admin-only special-time restriction: both ADMIN and RECEPTION can now use the existing manual phone-booking checkbox to create or reschedule a special appointment outside normal working/leave intervals. Both roles are already enforced by the staff-only API authorization. Doctor/public callers remain unable to override availability. Conflict checks, duration bounds, active doctor/service checks and atomic override audits remain in place. The help text is shared by both staff roles.

Removed the unsaved-change confirmation and its Continue/Discard buttons from the shared Modal, so every section closes edited forms immediately through Close, Cancel, Escape or backdrop. Removed dirty-value tracking from useModalGuard and updated all consumers (entity forms, schedule/day/week forms and patient notes). The hook now tracks pending saves/uploads only. No user-facing unsaved-change prompt or beforeunload interception remains in app/lib. Existing destructive-operation confirmations are separate from this request.

Verification: shared component regressions passed at 1440px and 390px for dropdown persistence and all four immediate-dismissal paths without saving drafts. All **18 isolated browser/API verification groups passed**, including Reception UI creation of an audited 08:10 appointment outside regular hours and Reception special-time rescheduling. **24 unit tests passed**. TypeScript/Next.js production build and lint passed; lint retains the three existing warnings. No schema changes or production migration/deployment were performed.
