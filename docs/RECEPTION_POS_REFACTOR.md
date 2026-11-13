# Reception and POS refactor

## Audit before implementation

The existing Reception workspace has ten role-specific modules: dashboard, patients, appointments, visits, queue, payments, transactions, receivables, notifications and reports. Its navigation is separate from Admin/Doctor navigation. `app/api/reception/[resource]` requires RECEPTION, and the general ERP API restricts Reception to options, availability, appointments and basic patients. Clinical history/notes, employees, prices, schedules, leave, inventory, expenses and Admin exports are restricted server-side.

Billing already uses Invoice/InvoiceItem and the existing append-only Payment ledger. Finalized invoices calculate balances from non-voided payments. Partial and split payments, duplicate request protection, reference deduplication, refund requests, own cash sessions and audited withdrawals/closing are implemented. Booking and check-in do not require payment. Checked-in appointments cannot be rescheduled. Patient archive checks outstanding invoices and active future appointments.

The old POS opens an invoice modal and then reveals another collection form. Users enter the total and allocation amount separately even for one payment. The displayed printable invoice is also called a receipt, without an individual checkout receipt or cashier identity. Payment options and reference rules are hardcoded to four enum values. Admin settings cover clinic/footer, branding, Telegram and system; payment method settings are absent.

Reusable components include `useResource`, `api`, Feedback, Modal (focus trapping/busy guards), EntityForm, patient search, calendar, existing branding/themes, audit and session logic. Patient search already supports name, phone and ID. Patient profiles expose only operational history and allergy warnings.

UX gaps: accounting terminology in navigation, calendar-first booking before selecting a patient, fragmented checkout, little actionable dashboard context, no configurable payment methods, no checkout-specific receipt. Queue lacks the service label. Report CSV and transaction filters already exist and must be retained. No mandatory prepayment workflow exists to remove; preserve payment-independent appointments and arrival.

## Implementation and validation

See the completion section added after implementation for migration, API, checks and deployment notes.

## Delivered behavior

- All ten existing routes remain. Navigation follows patient registration → booking → today's patients → queue → checkout → history/receivables/reports, with the requested Mongolian labels and existing mobile navigation/active states.
- Dashboard uses live appointment, queue, invoice and payment data; shows seven operational metrics, quick actions, waiting patients, unconfirmed appointments, payment alerts, unread events and doctor working hours/status. Doctor hours reuse the existing approved leave/override interval rules; “Ажлын цагт” describes working hours, not a guarantee that a particular slot is free.
- Patient profiles have five clearly named sections. Search supports name/phone/ID. The existing allergy warning, clinical privacy and archive restrictions remain.
- Reception booking starts with patient selection or inline registration, followed by service, eligible doctor, date and available time. The shared booking API and slot/conflict engine remain authoritative. Existing audited staff special-time booking is retained.
- Check-in and authorized queue transitions remain independent of booking confirmation and payment. Queue rows now include the service. Unpaid invoices do not block booking, confirmation or arrival.
- Checkout is an inline two-column patient/invoice selector and payment panel, stacking on smaller screens. Only finalized outstanding invoices are selectable for collection. Drafts still require explicit finalization at server-priced amounts; arbitrary prices/discounts are not accepted.
- A single payment amount is entered once. Splits calculate the combined payment and remaining balance; partial invoice payment remains supported. A summary and received-payment confirmation precede submission. During submission, patient/invoice changes and cash-session actions are disabled.
- Successful collection displays a distinct receipt with checkout receipt number, clinic, patient, invoice, timestamp, original method names/references, cashier and remaining balance. Split rows share one receipt. Browser printing/Save as PDF is supported; no ebarimt/tax receipt or automatic bank verification was added.
- Open cash sessions appear as a compact status summary above checkout, with session details, withdrawals and closing available by expanding it. Opening, ownership, expected cash, counted cash, discrepancy explanations and audit records remain intact.
- Historical transaction filters include disabled methods and pre-migration enum-only payments. Reports/receipts/transaction rows preserve historical method labels. Own session/payment movements and Reception-only report CSV exports remain available.
- Notifications include today's upcoming visits and live reminders; read events are hidden by default and can be shown explicitly. User-facing audit labels are translated.

## New payment configuration and migration

`202611130001_payment_methods` adds `PaymentMethodOption`, four enabled defaults, and optional Payment fields for the configured method, original method/cashier name and receipt-time remaining balance. A foreign key prevents deleting referenced options; the method/date index supports history filtering. Existing ledger enum categories remain the basis for cash accounting. The category of an existing configured option cannot be edited; a new option can be created instead.

The migration does not rewrite old settlements and preserves the existing immutability trigger. Old payments retain their original enum-derived label. Old receipt views explicitly label their balance as the current balance when no historical balance snapshot exists. New receipts retain their original balance even after later payments.

Admin Settings → Төлбөрийн хэлбэр supports adding, renaming, enabling/disabling, sorting, optional descriptions and reference requirements. POS options come from the server. Collection validates enabled status and reference policy inside the same transaction/lock as method changes. Renaming/disabling does not mutate historical payments. Legacy enum collection requests resolve to the corresponding configurable default and cannot bypass disabling.

## APIs

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `GET /api/payment-methods` | ADMIN, RECEPTION | All configuration for Admin; enabled options for Reception |
| `POST /api/payment-methods` | ADMIN | Create or edit an option, validate and audit; same-origin required |
| `GET /api/reception/receipt?id=PAYMENT_UUID` | RECEPTION | A checkout receipt, grouping split settlements |
| `GET /api/reception/transaction-methods` | RECEPTION | History filter labels, including disabled options |
| `POST /api/reception/collect` | RECEPTION | Configured method IDs; enabled/reference checks, cash-session requirement, immutable label/cashier/balance snapshots |
| Existing dashboard/reports/queue/notifications | RECEPTION | Added operational status, service labels, historical method breakdown and upcoming visits |

Existing appointment/patient endpoints and Admin-only export permissions are retained. Admin transaction displays and financial journal exports use stored method labels; the Admin portable data export includes method configuration.

## Changed files and reusable components

| Files | Purpose |
| --- | --- |
| `app/erp/reception.tsx`, `reception.css` | Dashboard, profiles, patient-first booking wrapper, queue, compact cash session, reports/notifications and integration with checkout |
| `app/erp/reception-pos.tsx` (new) | `ReceptionPOS`, shared `CheckoutForm`, shared `Receipt` |
| `app/erp/payment-method-settings.tsx` (new) | `PaymentMethodSettings` and configurable option type |
| `app/erp/settings-panel.tsx`, `shell.tsx`, `erp.css` | Admin settings section, requested Reception navigation and responsive styling |
| `app/erp/ui.tsx`, `workspace.tsx` | Reuse/export PatientPicker, original transaction labels and visible booking field labels/order |
| `lib/payment-methods.ts` (new) | Shared configuration validation, role checks, transaction locking and auditing |
| `lib/reception.ts`, `reception-domain.ts` | Collection policies, receipts, history, dashboard/queue/notification data and user-facing labels |
| `app/api/payment-methods/route.ts` (new) | Protected configuration API |
| `app/api/export/[kind]/route.ts`, `lib/data-export.ts` | Preserve original method labels/configuration in authorized Admin exports |
| `prisma/schema.prisma`, new migration | Additive payment configuration and snapshots |
| `scripts/test-reception.mjs`, `scripts/test-reception-browser.mjs`, `tests/reception-domain.test.ts` | Financial, policy, browser and regression verification |

The older modal → reveal collection form step was removed. Existing invoice details reuse the same checkout form directly. No mandatory prepayment gate existed in the inspected implementation; none was introduced. Historical deposits remain intact. No separate prepayment process was added.

## Security verification

Authenticated HTTP checks reject anonymous, Doctor and Admin callers to Reception-only APIs, and reject Reception/Doctor writes to payment configuration. The general ERP API still rejects Reception clinical records, doctor management, employees, settings, reports, financial bypasses and unrestricted/PDF clinical exports. Basic patient edits cannot overwrite clinical history or allergy warnings. Financial checks retain the open own-session requirement, invoice finalization, remaining-balance checks, duplicate/reference protection, immutable settlements and request-only refunds. Archive checks cover both outstanding invoices and future active appointments.

## Validation results

- `node --import tsx --test tests/*.test.ts`: 24 passed. This invokes the same test files without the sandbox-blocked IPC socket used by the `tsx` CLI.
- `bun scripts/test-reception.mjs`: 35 isolated integration checks passed. Includes all four default payment types, two/three-way splits, partial payments, duplicate submissions, disabled/default method bypass attempts, optional/required references, immutable historical labels/receipts, old ledger filtering, unpaid booking/check-in, archive restrictions, cash closing and audit.
- `bun scripts/test-v2-workflows.mjs`: passed existing account, scheduling, leave, eligibility, returning-contact/privacy and portable-export regressions.
- `bun scripts/test-reception-browser.mjs`: 25 browser/API verification groups passed on the final build. Uses Chromium, real HTTP routes and a temporary migrated PGlite database with real Prisma/PG adapter queries. All ten routes, patient registration/edit/search/profile, booking, queue, inline partial/split payments, receipts, Admin configuration, permissions and responsive layouts are exercised.
- TypeScript `npx tsc --noEmit`: passed.
- `bun run lint`: zero errors; three existing unused-variable warnings in ERP/Telegram routes.
- `bun run build:next`: passed. `bun run build`: Cloudflare/OpenNext build passed and generated `.open-next/worker.js`.
- Browser print invocation and a one-page receipt PDF were verified. Screenshots cover 1440px desktop, 820px tablet, 390px mobile and dark theme. Artifacts are in `/private/tmp/bb-reception-qa/` for this local run.

## Limits and deployment

PGlite exercises PostgreSQL semantics on a single connection; native multi-connection PostgreSQL contention/load remains unverified. Real Telegram delivery, bank/terminal/QPay settlement and a physical printer were not contacted. Financial integrations remain manual reference recording, and refunds remain requests only. PDF uses the browser print dialog's Save as PDF.

Builds succeed while emitting an existing `ERP request failed: Error` prerender diagnostic; the OpenNext bundler also warns about a duplicate `axisIndex` key in a generated dependency chunk. The PG adapter emits a query deprecation warning in isolated relational tests. These are not new application lint errors.

No hosted database migration or deployment was performed. Deploy the additive migration before serving the new application. With the intended test/production connection URLs set explicitly, run `bun run db:migrate`, then `bun run build`, then the existing `bun run deploy`. `DIRECT_URL` controls migrations and `DATABASE_URL` controls runtime; both must point to the intended environment. Start with the separate test database. Migration creates the four defaults automatically; no demo seed is required. Keep the historical migration in place when rolling back application code; it is additive and does not require deleting financial history.
