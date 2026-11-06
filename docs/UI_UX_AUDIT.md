# BB Dental — Phase 1 UI/UX audit

## Scope and status

**Phase 1 is complete. This is an audit, not a redesign or a completed refactor.** Findings describe the current working tree, including the UI migration and new functionality already present before this audit. Existing uncommitted work was preserved. This phase changes documentation only; it does not alter application components, CSS, dependencies, authentication, API contracts, business rules, Prisma schema or database records.

The baseline has 37 frontend implementation files: 33 TSX files and four stylesheets. The source review covers all five public/auth pages, all 18 ERP section values, nested forms/detail views, shared components, navigation permissions, loading/error/empty handling, light/dark styling, and relevant API response shapes. Backend files were read to establish existing permissions and UI contracts, not to propose styling-driven backend changes.

Evidence labels used below:

- **Source**: verified in the current implementation.
- **Browser**: measured in Chromium against the real public/auth pages or the actual ERP components with fixture router/session/API adapters.
- **Baseline**: a command executed during this audit.
- A fixture render verifies frontend behavior and layout; it does **not** establish real login, database authorization, successful CRUD, external delivery or production deployment.

## Existing roles and routes

`lib/domain.ts` and `prisma/schema.prisma` define **ADMIN, DOCTOR, RECEPTION**. There is no persisted `USER` role or authenticated patient dashboard/profile route in this working tree. The fourth requested perspective was reviewed as the **unauthenticated public/patient experience**. Do not add a role, dashboard, patient profile or medical-information portal during this refactor.

The shell's navigation is role-filtered. `/erp/[[...section]]` validates section names; the protected layout checks the staff session. Individual API operations enforce their roles and ownership. A hidden navigation item is not itself a route authorization boundary. This audit does not recommend replacing those server checks.

Legend: A = Admin, D = Doctor, R = Reception, P = Public. “Review” includes the source and responsive fixture render; it does not mean CRUD was submitted.

| Page / route | Roles with current navigation | Implementation reviewed | Findings |
| --- | --- | --- | --- |
| Home, services, doctors, booking and appointment lookup `/` | P | `home-page.tsx`, `home/Hero.tsx`, `public-clinic.tsx`, branding/theme components | 01–04, 16, 24, 26, 35–36 |
| Login `/login` | P | `login/page.tsx`, `auth-story.tsx`, `password-input.tsx` | 03, 14–16, 35–38 |
| Registration `/register` | P | `auth-form.tsx`, `auth-story.tsx` | 03, 14–16, 35–38 |
| Password recovery `/forgot-password` | P | `AuthForm` forgot mode, Telegram/email channel selection | 14–16, 29, 35–37 |
| Password reset `/reset-password` | P | `AuthForm` reset mode, password confirmation | 14–16, 29, 35–37 |
| Dashboard `/erp`, alias `/erp/dashboard` | A/D/R | `RoleHome`, `StandardWorkspace`, `DashboardView` | 03, 05–06, 16, 21–24, 29, 34 |
| Patients `/erp/patients` | A/D/R | Generic list/form, `PatientCard`, clinical history, notes, transfer, PDF link | 09–25, 29, 32, 34 |
| Appointments `/erp/appointments` | A/D/R | List/status controls, `AppointmentForm`, repeat/reschedule/treatment/payment/reminder actions | 09–25, 29, 34 |
| Calendar / check-in `/erp/calendar` | A/D/R | `RosterCalendar`, `CalendarView`, status selection and patient-card entry | 08–11, 16–17, 21–25, 31, 34 |
| Doctors `/erp/doctors` | A/D/R; mutation/detail actions vary | Generic doctor form, Telegram action, `DoctorDetail` | 09–11, 14–20, 23–25, 27, 34 |
| Employees `/erp/users` | A | `Employees`, `employeeFields`, approval/role dialogs, Telegram disclosure/link modal | 09–11, 14–18, 24–25, 29–30, 33 |
| Services `/erp/services` | A/D/R; mutations A | Generic service form, image upload, doctor eligibility checklist | 09–11, 14–16, 18–25, 27 |
| Treatments / treatment records `/erp/treatments` | A/D/R; mutation permissions vary | Generic form, `ToothPicker`, patient/service/doctor fields | 09–25, 32 |
| Payments / cashier `/erp/payments` | A/R | Generic payment form, patient picker, void-reason prompt | 09–25, 29, 34 |
| Expenses `/erp/expenses` | A | Generic expense form/list | 09–11, 14–16, 18–25, 29 |
| Inventory `/erp/inventory` | A/R; mutations A | Generic item form/list, stock movement dialog | 09–11, 14–16, 18–25, 29 |
| Documents / medical records `/erp/documents` | A/D/R; ownership/operations vary | Generic document form, document view/PDF, patient selection | 09–25, 34 |
| Reports / finance `/erp/reports` | A | `DashboardView`, service breakdown, filters, Excel/PDF links | 03, 05, 16, 19–24, 34 |
| Settings `/erp/settings` | A | `SettingsPanel`, clinic/footer/branding tabs, `TelegramPanel`, `SystemPanel` | 14–16, 24–30, 33–38 |
| Weekly work schedules `/erp/schedules` | A/D/R; mutations A/D | `RosterCalendar`, `ScheduleForm`, `WeekScheduleEditor`, generic schedule list | 08–11, 14–17, 19–25, 31, 34 |
| Leave / daily overrides `/erp/leaves` | A/D/R; request/review permissions vary | Generic leave form/list, approval/rejection actions | 09–11, 14–16, 18–25, 29, 34 |
| My profile `/erp/profile` | A/D | `Profile`, `EntityForm`, image/avatar and Telegram controls | 14–16, 24–25, 27, 29, 37 |
| Audit log `/erp/audit` | A | Generic read-only table/filter/pagination | 07, 19–24, 34 |
| Unknown/failed route | Public and staff | Framework defaults; no app-authored `error.tsx`, `global-error.tsx` or `not-found.tsx` | 35 |

Finance is implemented through payments, expenses and reports. Medical records are implemented through patient cards, treatments and documents. They are not additional standalone routes. Reception check-in is an appointment status operation, not a separate page. Public appointment history is the lookup panel on `/`, not an authenticated dashboard.

## Existing visual identity to preserve

These are extracted values, not a proposed replacement palette or new token implementation.

| Category | Current values and origin |
| --- | --- |
| Primary / dark primary | `#007779` / `#005f62` (`v2-theme.css`) |
| Accent | `#85ded3`; teal sidebar with light text |
| Light background / surface / soft surface | `#f6fbfa` / `#ffffff` / `#f1f9f6` |
| Light text / muted / border | `#183d3e` / `#5c7778` / `#dcebea` |
| Dark background / surface / soft surface | `#101d25` / `#172731` / `#1d333d` (`globals.css`) |
| Dark text / muted / border / ERP accent | `#e3edf1` / `#a4bac5` (also `#a0b7c4`) / `#30454f` / `#54c4bd` |
| Typography | Inter body, Merriweather display headings; installed weights 400/500/600/700 for Inter and 400/600 for Merriweather; legacy Arial/Helvetica and Georgia rules remain |
| Spacing in active/legacy rules | 8, 10, 12, 14, 16, 18, 20, 24, 25, 28, 32, 36, 40, 48, 64, 72, 80px; not a unified scale |
| Radius | 8–12px controls, 16px current cards/dialogs, 24px profile avatar, circular/pill variants |
| Shadows | Card `0 2px 8px #00777904`; native-dialog `0 25px 100px #073a4633`; distinct existing hero shadows |
| Shell | Current computed desktop sidebar 256px; collapsed 96px; mobile 280px at audited phone widths, CSS capped at 88vw |
| Controls | Primary/secondary targets generally 44px, auth controls 48px, navigation rows 46px; specialised/icon controls diverge |
| Modal | Desktop width 660px, max-width `100vw - 32px`, max-height 90vh, native dialog top layer |
| Z-index | Local menu 10, topbar 20, mobile shade 29, sidebar 30, public header 40, toast 60, theme switcher 70, skip link 10000; native dialog uses the top layer |
| Breakpoints | Active shell boundary 900/901px; additional rules at 380, 420, 550, 600, 640, 800, 950, 1100, 1150, 1200, 1250, 1600 and 1700px |

The next phase should consolidate these existing semantics into `app/styles/design-tokens.css` (the repository uses `app/`, not `src/`). **No token file or application styling was changed in Phase 1.**

## Confirmed shared findings

IDs in the route matrix refer to the following register. Critical means an immediately blocking application-wide usability issue; High means a blocked workflow, material accessibility/state problem or failed required quality gate; Medium means recurring usability/maintenance inconsistency; Low means local polish or clearly bounded debt. There are no confirmed Critical findings in this audit.

| ID | Page / component | Identified problem | Severity | Root cause / evidence | Recommended solution | Files affected |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | All pages / stylesheet ownership | Current styling depends on legacy rules, dark selectors and a second theme override layer. | High | Source: four stylesheets, 7,170 lines, 1,277 rules, 52 custom-property declarations covering 26 property names. Five exact duplicate selector/context groups; differently scoped overrides add more interactions. | Establish ownership and import order; replace duplicate declarations incrementally rather than append specificity overrides. Preserve computed identity. | `app/globals.css`, `app/erp/erp.css`, `app/v2-theme.css`, `app/components/home/hero.css`, `app/layout.tsx` |
| 02 | All pages / tokens | No shared spacing, radius, shadow, control-height, layer or breakpoint contract. | Medium | Source: semantic colour aliases coexist with hard-coded component dimensions and many independent media queries. | Extract the existing values into one token source; document approved aliases and responsive ranges before component changes. | Four stylesheets; future `app/styles/design-tokens.css` |
| 03 | Dashboard, header, sidebar / text hierarchy | Important supporting text is 9–11px and fails normal-text contrast in sampled light-mode pairs. | High | Browser: metric hint 2.32:1, kicker 2.49:1, breadcrumb 2.47:1, user role 2.40:1, sidebar section label 3.88:1. Corresponding dark samples passed 4.5:1. Legacy hard-coded grey values bypass semantic tokens. | Map secondary text to accessible existing palette values and consistent type roles; preserve Inter/Merriweather and primary branding. Test contrast in both themes. | `app/erp/erp.css`, `app/globals.css`, `app/v2-theme.css` |
| 04 | Public home / legacy presentation code | Unused old hero/deck selectors remain alongside the active `v2-hero-*` implementation; icon drawing approaches differ. | Low | Source: old `.hero-inner`/`.card-stack` styling remains after the hero component moved. `home-page.tsx` retains a custom SVG icon map while most UI uses Lucide. | Prove references before removing obsolete selectors/icons; reuse existing icons without changing the current visual treatment. | `app/components/home-page.tsx`, `app/components/home/Hero.tsx`, `app/globals.css` |
| 05 | ERP shell / Header | Header height is 80px at 375/390/430px but 97px at 768px and wider. Search wrapper is 66px high. | High | Browser and source: broad `min-height:44px` control selectors outrank the smaller search-input rule; wrapper padding then expands an auto-height header. | Define one header/control composition and consistent search sizing at the owning rules; do not conceal it with a fixed-height clipping override. | `app/erp/shell.tsx`, `app/erp/erp.css`, `app/v2-theme.css` |
| 06 | All staff mobile pages / Sidebar | Closed off-canvas navigation remains keyboard-focusable; open drawer has no focus containment, inert background or Escape handler. | High | Source and DOM: transform-only hiding, up to 20 sidebar anchors retain tab order while offscreen in Admin at 375px. Native modal protections are not applied to this drawer. | Normalise mobile drawer semantics and keyboard lifecycle while keeping the role-filtered navigation data. Prevent hidden links from receiving focus. | `app/erp/shell.tsx`, `app/erp/erp.css` |
| 07 | Direct unauthorized ERP URLs / route shell | A hidden section can still render its heading/affordances before a role-restricted API returns an error. | Medium | Source: layout checks session, catch-all validates names, while section-specific permission checks live in APIs and some specialised components. This is a UX finding, not a demonstrated server authorization bypass. | Reuse the current role/section mapping for a clear frontend denied state; retain every API authorization check. | `app/erp/[[...section]]/page.tsx`, `app/erp/workspace.tsx`, `app/erp/shell.tsx` |
| 08 | Calendar and schedules / page hierarchy | Large roster panel precedes the page H1 and primary section actions. Two calendar presentations appear on the calendar page. | Medium | Source: `WorkspaceSection` renders `RosterCalendar` before `StandardWorkspace`. The roster can occupy most of a mobile screen before the page title. | Use a consistent page header and labelled content sections; retain both team staffing and appointment functionality, with clear hierarchy. | `app/erp/workspace.tsx`, `app/erp/roster-calendar.tsx` |
| 09 | All dialogs / Modal | Dialogs have a visible H2 but no accessible dialog name. | High | Browser: all 22 sampled create dialogs have neither `aria-label` nor `aria-labelledby`; source does not connect the H2 to `<dialog>`. | Add a stable heading ID/name association to the existing native Modal, retaining native focus and Escape handling. | `app/erp/ui.tsx` and all Modal consumers |
| 10 | Schedule and generic dialogs / modal body | Body gutters differ: generic form 20px mobile/25px desktop, appointment prelude differs, schedule form 0px. | Medium | Browser: same 343px/660px modal frame, different child-owned padding. Modal has no shared body slot. | Standardise a body/footer contract in the existing Modal composition; migrate specialised children without double padding. | `app/erp/ui.tsx`, `app/erp/schedule-form.tsx`, `app/erp/week-schedule-editor.tsx`, `app/erp/doctor-detail.tsx`, `app/erp/erp.css` |
| 11 | Mutation dialogs / dismiss lifecycle | Close, Escape or backdrop dismissal can discard edits or close a dialog while a save is pending. | High | Source: Modal does not know EntityForm/specialised-form busy or dirty state. Some forms disable fields but not the enclosing close control. | Define a shared pending/dismiss policy and explicit unsaved-edit handling; keep mutation payloads and APIs unchanged. | `app/erp/ui.tsx`, `app/erp/schedule-form.tsx`, `app/erp/week-schedule-editor.tsx`, `app/erp/employees.tsx`, `app/erp/workspace.tsx` |
| 12 | Appointment creation / PatientPicker | “Choose a registered patient OR enter new name/phone” is contradicted by a permanently required patient select. | High | Source: `AppointmentForm` declares the patient picker optional; `PatientPicker` hard-codes `<select required>`. Native validation can block the advertised new-patient path before submit. No real booking was submitted during audit. | Pass the existing field requirement through the picker and retain the submit handler's current either/or validation. Test both existing and new-patient paths. | `app/erp/ui.tsx`, `app/erp/workspace.tsx` |
| 13 | Appointments, treatments, documents, payments / compound labels | The patient select is unnamed even though its search input is named. | High | Browser: one unlabelled SELECT in each sampled patient-picker dialog at both 375 and 1440px. Outer label contains multiple labelable controls. | Give search and selection separate explicit labels/IDs; use a fieldset/legend or group when appropriate. | `app/erp/ui.tsx` (`PatientPicker`, `EntityForm`) |
| 14 | All forms / validation feedback | Errors are form-level alerts; hints and failed controls are generally not associated with IDs, `aria-describedby` or `aria-invalid`. | Medium | Source: only schedule calendar help has a described-by relationship; EntityForm renders plain hint text and a shared error string. | Reuse a field/error presentation contract and error focus strategy while preserving validators, messages and payload types. | `app/erp/ui.tsx`, `app/components/auth-form.tsx`, `app/login/page.tsx`, specialised forms |
| 15 | Shared and specialised forms / controls | EntityForm, auth, booking, schedule, week and settings each own dimensions and label spacing. | Medium | Source: independent control selectors and JSX; no shared field presentation contract. Native date/time controls are already used. | Consolidate existing field rendering/styling first. Preserve native control behaviour; do not add a date-picker dependency solely for consistency. | `app/erp/ui.tsx`, schedule/week/settings/system components, `app/components/public-clinic.tsx`, auth components, stylesheets |
| 16 | All pages / buttons | Multiple class families and bespoke controls lack one variant/size/loading/disabled contract. | Medium | Source: `.button`, `.erp-primary`, `.erp-secondary`, `.employee-role-button`, icon buttons and hero buttons have separate rules; not all async actions expose progress or disable consistently. | Extend the current shared UI layer with a minimal reusable button contract; preserve hero-specific styling where intentional. | `app/erp/ui.tsx`, all button consumers, four stylesheets |
| 17 | Dialogs and tooth selection / touch targets | Modal close is 20×20px; mobile FDI teeth can be 18px wide. | High | Browser: every sampled modal has a 20px close target; permanent teeth in a 375px treatment form measured 18px wide. Inline links and checkboxes require separate spacing/target assessment, not automatic WCAG failure claims. | Enlarge hit areas within the established layout; use an appropriate scroll/selection pattern for the odontogram instead of shrinking every tooth. | `app/erp/ui.tsx`, `app/components/tooth-picker.tsx`, `app/erp/workspace.tsx`, `app/erp/erp.css` |
| 18 | Tables / row action identification | Repeated generic “Засах”, “Устгах” and status labels lack row context; some icons rely on title tooltips. | Medium | Source: labels are shared across rows; native title is a fallback name but is not a reliable touch explanation. | Add record-specific accessible names and a consistent action grouping/tooltip policy without changing which actions each role receives. | `app/erp/workspace.tsx`, `app/erp/employees.tsx` |
| 19 | Data tables / responsive scrolling | Scroll wrappers protect the page from overflow but lack a labelled, keyboard-focusable scrolling region. | High | Browser: 103 role/viewport samples required inner table scrolling; sampled wrappers had negative tabIndex. This is not accidental page overflow. | Keep horizontal scrolling; add a consistent region/name/focus treatment and verify keyboard access, especially for read-only tables. | `app/erp/workspace.tsx`, `app/erp/erp.css` |
| 20 | List and detail pages / Pagination | Generic pagination is duplicated and “total” can mean current page length when the existing response omits total. Next is inferred from 50 returned rows. | Medium | Source: `setTotal(response.total || response.items?.length || 0)`, generic controls and a separate DoctorDetail pager. | Reuse one pager presentation; accurately label available counts and handle empty terminal pages using the current response contracts. Do not invent totals or change APIs for styling. | `app/erp/workspace.tsx`, `app/erp/doctor-detail.tsx` |
| 21 | Generic searchable lists / request state | Older list responses can overwrite newer filtered results. | High | Source: the 200ms debounce cancels only the timer; once `load()` starts, no request identity/abort guard protects later state. Other components already use alive guards. | Standardise request-state ownership/cancellation on filter changes without altering endpoints. Verify rapid typing/filter changes. | `app/erp/workspace.tsx` (`StandardWorkspace`) |
| 22 | Generic lists / action failures | A failed row mutation or detail fetch removes the whole existing data panel. | High | Source: one `error` state is used for fetch, mutations and detail actions; render branches require `!error`. | Separate page-load failures from local action failures; preserve existing rows and show an action-local error/retry. | `app/erp/workspace.tsx` |
| 23 | Generic create/edit forms / option loading | Option-fetch failures are silently swallowed, leaving empty doctor/service selectors without explanation. | High | Source: `/api/erp/options` has `.catch(() => {})`. | Expose the options loading/error/empty states and retry; gate dependent forms until their current data is usable. | `app/erp/workspace.tsx` |
| 24 | Lists and nested panels / loading and empty states | Full coloured BrandLoader, plain text, inline placeholders and custom empties are mixed; initial zero counters can resemble real data. | Medium | Source and browser: generic empty/error/loading states exist, but reuse is inconsistent. BrandLoader replaces whole content regions; skeleton presentation is absent. | Preserve the brand loader for appropriate transitions; reuse an inline/skeleton/empty contract with stable page geometry and truthful counters. | `app/components/brand-loader.tsx`, `app/erp/ui.tsx`, employees/roster/profile/settings/detail components, `app/page.tsx` |
| 25 | Profile, doctor detail, employees and nested panels / errors | Recovery affordances vary: generic lists have retry, while several detail panels expose only an error string. | Medium | Source: Profile and DoctorDetail return/retain error content without a local retry; other panels use bespoke load methods. | Standardise retryable error presentation using existing fetch functions; keep the current role/ownership scope. | `app/erp/profile.tsx`, `app/erp/doctor-detail.tsx`, `app/erp/employees.tsx`, `app/erp/settings-panel.tsx`, `app/erp/roster-calendar.tsx` |
| 26 | Public services/doctors / catalogue states | A failed catalogue request and a genuinely empty doctor list can look like “information coming soon.” | Medium | Source: doctor empty copy ignores catalogue error; services and booking use different fallbacks for the same request. | Separate loading, unavailable, error and empty presentation, retaining the existing phone-booking fallback. | `app/components/public-clinic.tsx` |
| 27 | Branding settings / ImageUpload | Upload feedback can report completion before the settings persistence callback completes or fails. | High | Source: `onChange` is typed void and invoked without awaiting; branding consumers pass async PATCH callbacks. Their failure is not caught by the upload's try/catch. | Make the existing upload/persistence handoff handle async completion and display failures consistently; preserve upload and settings endpoints. | `app/components/image-upload.tsx`, `app/erp/settings-panel.tsx`, `app/erp/workspace.tsx` |
| 28 | Settings / failed initial load | Default editable values can remain actionable after loading the stored settings fails. | High | Source: settings/system panels clear loading in finally while keeping fallback values and displaying an error. | Distinguish “loaded empty” from “failed to load”; provide retry and prevent an unknown stored value from being silently replaced. | `app/erp/settings-panel.tsx`, `app/erp/system-panel.tsx` |
| 29 | All mutations / feedback | Success/error feedback is duplicated; timers, placement, dismissal and status semantics differ. | Medium | Source: workspace 3500ms, settings 4000ms, employees 4500ms; profile/system notices persist. Multiple local toast implementations share only a CSS class. | Reuse a single existing feedback presentation/lifecycle contract with accessible announcements and consistent dismissal. | `app/erp/ui.tsx`, workspace/employees/profile/settings/system components, `app/components/public-clinic.tsx` |
| 30 | Staff settings/users / duplicate implementation paths | Unreachable generic settings/users UI remains alongside specialised components. | Medium | Source: `WorkspaceSection` returns SettingsPanel/Employees before StandardWorkspace, which still contains related rendering/form branches. | Prove references and remove only obsolete paths in a bounded cleanup; retain shared field builders that other forms actually use. | `app/erp/workspace.tsx`, `app/erp/settings-panel.tsx`, `app/erp/employees.tsx` |
| 31 | Team/work calendars / interaction pattern | Multiple calendars use different selection semantics and many tab stops; no unified keyboard-date navigation contract. | Medium | Source: roster selects a date; ScheduleForm selects a recurring weekday; appointment calendar uses a different card/grid layout. Native month input follows browser locale. | Keep the semantic distinction explicit, standardise labelled month controls and keyboard guidance, and preserve recurring-vs-single-day behaviour. | `app/erp/roster-calendar.tsx`, `app/erp/schedule-form.tsx`, `app/erp/week-schedule-editor.tsx`, `app/erp/workspace.tsx` |
| 32 | Patient card and treatment form / odontogram | Two separate tooth renderers have different geometry, terminology/controls and selection behaviour. | Medium | Source: `PatientCard` maintains its own rows/SVG while `ToothPicker` is another implementation. Patient-card chart scrolls at a 520px minimum; picker instead shrinks teeth. | Share proven FDI data and presentation primitives, preserving distinct read/history and edit interactions and reception restrictions. | `app/components/tooth-picker.tsx`, `app/erp/workspace.tsx`, `app/erp/erp.css` |
| 33 | Employee actions and destructive flows / overlays | Native details, native confirm/prompt and Modal each have unrelated dismissal, dimensions and error presentation. | Medium | Source: employee action disclosures, generic delete confirm and payment void prompt. Native details is not automatically an ARIA menu and should not be treated as one without implementing its keyboard contract. | Standardise the existing overlay conventions incrementally; retain native accessibility or deliberately implement equivalent behaviour. Keep destructive validation/audit semantics. | `app/erp/employees.tsx`, `app/erp/workspace.tsx`, `app/erp/ui.tsx` |
| 34 | Audit log, calendars and summaries / formatting | Raw ISO dates, trimmed timestamps, localised system timestamps and browser-native month text are mixed. | Medium | Source: audit cells slice `createdAt`; SystemPanel explicitly uses Asia/Ulaanbaatar; other components display date strings directly. | Reuse display-only clinic date/time/money helpers with clear labels. Do not change stored dates, timezone calculations or business periods. | `app/erp/workspace.tsx`, `app/erp/system-panel.tsx`, `app/erp/doctor-detail.tsx`, `app/erp/roster-calendar.tsx`, `app/components/public-clinic.tsx` |
| 35 | All routes / unexpected errors, not-found and titles | Default framework fallbacks and the same generic document title lack page-specific recovery/context. | Medium | Source: no app-authored error/not-found boundary; root metadata has one title and empty description. | Add bounded, localised fallback/metadata presentation using the installed Next.js conventions; preserve redirects and authorization. | `app/layout.tsx`, `app/erp/[[...section]]/page.tsx`, future boundary files |
| 36 | Whole app / theme lifecycle | System/persisted theme is applied after mount, allowing a light-to-dark flash; themed rules remain split across stylesheets. | Medium | Source: ThemeToggle applies data-theme in useEffect; root only suppresses hydration warning. Flash severity was not timed in this audit. | Resolve initial theme consistently and consolidate existing light/dark token ownership. Preserve all three theme choices. | `app/components/theme-toggle.tsx`, `app/layout.tsx`, `app/globals.css`, `app/v2-theme.css` |
| 37 | Profile/system/review actions / async affordances | Busy states often disable a button without naming the ongoing operation; review controls do not consistently expose local progress. | Medium | Source: a shared busy boolean in SystemPanel, profile Telegram actions and inline leave-review callbacks differ from EntityForm's save text. | Standardise operation-specific busy text/announcement and prevent duplicate UI submissions while retaining server idempotency/rate limits. | `app/erp/profile.tsx`, `app/erp/system-panel.tsx`, `app/erp/workspace.tsx` |
| 38 | Registration/login / policy copy | Static approval guidance can conflict with the existing doctor auto-approval setting. | Low | Source: auth guidance describes admin approval while the registration response can approve a doctor immediately. | Use accurate neutral guidance and the existing result message; do not change approval policy or expose new data. | `app/components/auth-form.tsx`, `app/login/page.tsx` |
| 39 | Frontend quality gate / ESLint | Required lint baseline fails with 11 errors and 14 warnings. | High | Baseline: effect-state rules, reserved `module` variables, unused imports, navigation warnings and a spread-alt warning. Generated `.open-next` files add four of the recorded warnings. | Fix the relevant frontend issues in bounded phases, preserving behaviour. Treat generated-artifact scope separately; do not disable rules to manufacture a pass. The alt-spread warning is not proof that current callers omit alt. | `eslint.config.mjs`, public-clinic/clinic-branding components, catch-all page, workspace, employees, roster, detail, settings, shell/login; see baseline evidence |
| 40 | Release validation / real workflows | Responsive fixture renders are not a complete authenticated end-to-end regression suite. | High | Baseline: `ERP_TEST_DATABASE_URL` is not configured. Existing E2E requires an isolated localhost `_test` database and production server. No production CRUD or real integration delivery was exercised. | In Phase 7 run existing authenticated E2E against isolated data and verify the requested role/workflow matrix. Never substitute fixture layout passes for that gate. | `playwright.config.ts`, `e2e/00-registration.spec.ts`, `e2e/erp.spec.ts`, `e2e/telegram-preload.mjs` |

## Responsive and accessibility measurements

The primary sweep used all requested widths. There were **40 public/auth route-width checks and 328 permitted staff-role/section-width checks**, plus **22 create-dialog checks** at 375 and 1440px. Staff renders used the actual source components but substituted the Next router/session/data boundary; this avoids production records and is explicitly not authenticated E2E.

| Width | Public/auth checks | Staff role/section checks | Accidental document horizontal overflow | ERP header | Sidebar pattern |
| --- | --- | --- | --- | --- | --- |
| 375px | 5 | 41 | None observed | 80px | Off-canvas, 280px panel |
| 390px | 5 | 41 | None observed | 80px | Off-canvas, 280px panel |
| 430px | 5 | 41 | None observed | 80px | Off-canvas, 280px panel |
| 768px | 5 | 41 | None observed | 97px | Off-canvas, 280px panel |
| 1024px | 5 | 41 | None observed | 97px | 256px desktop panel |
| 1280px | 5 | 41 | None observed | 97px | 256px desktop panel |
| 1440px | 5 | 41 | None observed | 97px | 256px desktop panel |
| 1920px | 5 | 41 | None observed | 97px | 256px desktop panel |

Additional observations:

- All 22 create-dialog samples fit the document width. Frame widths were 343px at a 375px viewport and 660px at 1440px. Content scrolls inside the bounded dialog; do not “fix” this by shrinking controls.
- All 22 sampled dialogs had no accessible name and a 20×20px close control.
- Appointment, treatment, document and payment dialogs each exposed one unnamed patient-selection select at both sampled widths.
- Schedule-form body padding was 0px; generic forms were 20px mobile / 25px desktop. This is a confirmed composition inconsistency, not a reason to give every modal a different width.
- The populated treatment picker at 375px rendered adult tooth targets at 18px width. Checkboxes measured 18×18px but their enclosing label hit areas must also be considered.
- 103 staff role/width samples needed inner table scrolling. Their wrappers were not keyboard-focusable. Intentional clipped carousel cards and scrollable tables were not counted as document overflow.
- The shared services screen's empty, error and loading branches were rendered separately: one empty state, one alert, and one brand loader respectively. Mutation-failure preservation, all nested empty/error variants, long clinical narratives, zoom, touch hardware and screen-reader journeys are not certified by that sample.
- Sampled light/dark computed colours were compared numerically. This is a targeted contrast check, not a complete automated WCAG audit.
- No page-level JavaScript errors were observed in the 368 primary fixture checks. No forms were submitted to a clinic database.

Temporary raw measurements are in `/private/tmp/bb-ui-audit/results.json` and `/private/tmp/bb-ui-audit/supplemental.json`; CSS and lint baselines are `/private/tmp/bb-ui-audit-css.json` and `/private/tmp/bb-ui-audit-eslint.json`. These are local audit artifacts, not production fixtures or application dependencies. Their results are summarised here so this document remains useful if temporary artifacts are removed.

## Existing components to reuse

| Area | Existing foundation | Consolidation boundary for later phases |
| --- | --- | --- |
| Buttons and fields | `app/erp/ui.tsx` (`EntityForm`, `Field`), existing class families | Extend minimally rather than create parallel public/staff libraries |
| Password input | `app/components/password-input.tsx` | Preserve reveal state and accessible toggle |
| Upload | `app/components/image-upload.tsx` | Preserve raster validation, purpose and upload endpoint; fix async feedback handoff |
| Dialog | Native `Modal` in `app/erp/ui.tsx` | Name/body/footer/pending conventions; no replacement dialog package needed |
| Data display | `Badge`, `Empty`, `Money`, generic table and existing metric cards | Normalise variants, semantics, pagination and states |
| Brand/loading/avatar | `ClinicLogo`, `ClinicBrandingProvider`, `BrandLoader`, `UserAvatar` | Retain setting-based logo, image fallback and current branding |
| Calendars | `RosterCalendar`, `ScheduleForm`, `WeekScheduleEditor`, `CalendarView` | Share presentation where semantics match; do not merge recurrence and date exceptions blindly |
| Dental display | `ToothPicker` and patient-card chart | Share FDI data and accessible hit areas, keeping read/edit permissions |
| App/auth shell | `ErpShell`, `AuthStory`, `AuthMobileBrand`, shared AuthForm | Keep navigation/RBAC mapping and working form integrations |

There are no installed shadcn/ui or Radix component dependencies in `package.json`, and no existing shadcn component directory to adopt. Do not add them solely to satisfy component category names. There is no separate popover, radio-group or alert-dialog component to consolidate today; reuse native controls or existing foundations where those interactions are actually required.

## Baseline checks executed

| Check | Result | Practical limit / notes |
| --- | --- | --- |
| `bunx tsc --noEmit --incremental false` | Pass | No new application source was written |
| `bun run lint --format json --output-file /private/tmp/bb-ui-audit-eslint.json` | **Fail: 11 errors, 14 warnings** | 14 files with findings; counts were recorded before the production build refreshed generated artifacts |
| `node --import tsx --test tests/*.test.ts` | Pass: 15 tests | Domain, delivery mocks, PDF/image and work-interval tests; not page CRUD |
| `bun run test:workflows` | Pass | In-memory migrations/rollback, approval/ownership, registration policy, export exclusions, endpoint roles, mocked Telegram throttling and diagnostics; single-connection PGlite |
| `bun run build` | **Pass: Next.js and OpenNext worker generated** | One generic `ERP request failed: Error` message during prerender and a duplicate `axisIndex` warning in bundled generated code; investigate before release, do not label as UI failures without tracing |
| Chromium public/auth width sweep | Pass for document width at all eight widths | Public APIs mocked; no real login or mutation submission |
| Chromium staff component width sweep | No accidental document overflow in 328 samples | Router/session/API fixture adapters; real server-side RBAC not exercised by these renders |
| Dialog and state samples | Completed; findings recorded above | 22 create dialogs; shared services empty/error/loading states |
| Existing full authenticated Playwright E2E | **Not run** | Isolated `ERP_TEST_DATABASE_URL` is not configured; production data was not used as a substitute |

Full E2E verification still needs login/logout, authenticated navigation and RBAC, patient/appointment CRUD, doctor/employee/service management, payments, finance, reports and form validation against isolated data. A production build alone does not prove those interactions work.

## Bounded implementation order after Phase 1

1. **Phase 2 — tokens and CSS ownership.** Create `app/styles/design-tokens.css` and `docs/DESIGN_SYSTEM.md` from the extracted palette/type/dimensions. Work only in the four owning stylesheets and root import order. Snapshot computed colours, fonts, widths and breakpoint behavior before and after.
2. **Phase 3a — existing Modal and field foundations.** Address 09–17 in `ui.tsx`, upload/password/tooth components and their direct consumers. Add keyboard/validation checks before changing dismiss or controlled-form state. Keep API payloads intact.
3. **Phase 3b — feedback, data display and request presentation.** Address 19–29 through existing list/table/feedback foundations. Separate UI request/error ownership without touching database queries or API contracts.
4. **Phase 4 — shell.** Address 05–08 using `shell.tsx` and owning CSS. Verify expanded/collapsed/mobile navigation, keyboard order and every existing role's links.
5. **Phase 5 — page batches.** Public/auth; patient/appointment/clinical; scheduling/profile; finance/inventory; employees/settings/audit. Each batch has a small file list, before/after comparison, relevant checks and an updated progress entry.
6. **Phase 6 — responsive regression.** Repeat all eight widths in both appropriate themes; include populated, empty, error, loading, long-text and open-overlay states. Preserve intentional table scrolling.
7. **Phase 7 — final QA.** Resolve lint failures, repeat production build and existing tests, run authenticated isolated-data E2E and document remaining issues. Only then create `docs/UI_UX_FINAL_REPORT.md` as a project completion report.

If fixing a frontend finding would change appointment state policy, clinical visibility, authentication, API data shapes, persistent settings or a Prisma operation, stop that implementation slice and document the risk. The refactor must adapt to existing business semantics rather than change the backend to make a layout pass.

## Phase 1 completion checklist

- [x] Existing route and frontend file inventory reviewed.
- [x] Admin, Doctor and Reception navigation/pages reviewed.
- [x] Public/user perspective reviewed; nonexistent authenticated USER modules explicitly excluded.
- [x] Existing visual identity and dimensions extracted without inventing branding.
- [x] Shared components, duplicate paths and stylesheet conflicts documented.
- [x] Loading, empty, error, validation, accessibility and overlay patterns reviewed.
- [x] All eight requested widths measured; 368 primary renders and 22 dialog samples recorded.
- [x] TypeScript, lint, unit tests, isolated workflow tests and production-build baseline recorded.
- [x] Untested real workflows, failures and limitations distinguished from verified passes.
- [x] No application-code or database changes made during this audit.
- [ ] Phases 2–7 are not implemented by this audit; the overall refactoring definition of done is not yet met.
