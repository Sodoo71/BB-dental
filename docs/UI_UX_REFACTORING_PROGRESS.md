# UI/UX refactoring progress

Phase 1 audit is authoritative: [UI_UX_AUDIT.md](UI_UX_AUDIT.md). Implementation is incremental on branch `main`. Existing uncommitted work was inventoried and source hashes captured before this task. Backend, library, schema, dependency and API changes from earlier work are protected.

| Phase | Status                                          | Evidence                                                                                                    |
| ----- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1     | Complete                                        | Existing complete audit, 40 findings                                                                        |
| 2     | Implemented                                     | Extracted tokens, explicit root CSS order, styles moved to their component owners, DESIGN_SYSTEM.md         |
| 3     | Implemented                                     | Shared dialog/form/control/request states, targeted browser checks                                          |
| 4     | Implemented                                     | 80px header, role navigation, mobile focus/inert/Escape                                                     |
| 5     | Implemented; authenticated verification pending | Existing page batches, APIs and role definitions preserved                                                  |
| 6     | Complete in Chromium                            | Final 736 page/176 dialog samples pass at all eight widths, both themes; long text and 13 interactions pass |
| 7     | Available checks complete; E2E blocked          | TypeScript, lint, unit, workflow, build and browser checks pass; authenticated release gate remains         |

## Implementation log

- Initial baseline: retained all existing modifications; snapshot at `/private/tmp/bb-refactor-baseline.json`. No schema resets, backend changes or dependency installs.
- Phase 2: extracted existing palette and dimensions; relocated structural rules out of v2-theme; imported CSS once from root. Styles preserve existing selector precedence. TypeScript passed after shared form changes.
- Phase 3: modal title/focus restoration, busy/dirty guard, explicit field associations, native validation messages, optional patient selection, async upload persistence; common feedback, skeleton, button and pagination primitives.

## Required remaining checks

- [x] Review every existing page/role against audit findings.
- [x] Browser matrix at 375, 390, 430, 768, 1024, 1280, 1440, 1920px, light/dark.
- [x] Representative populated/empty/loading/error/retry/dialog/validation/keyboard states with isolated fixtures.
- [x] TypeScript, lint, unit, workflow and production build.
- [ ] Authenticated E2E on isolated test DB if configured; do not use production DB.

## Phase 3 validation and completed contracts

- Extended the existing `ui.tsx` foundations; no UI library/dependencies added. `useResource` derives loading from request identity and aborts obsolete responses. `useMessage` consolidates existing transient feedback lifetime.
- Modal titles, common gutters, native focus, explicit busy/dirty dismissal and per-form guard registration cover EntityForm, schedule/week, appointment selectors and patient-note drafts. Nested forms cannot overwrite each other's pending guard.
- EntityForm has explicit field IDs/labels, hint/error associations, native validation messages, focused submission error and disabled pending controls. Appointment patient selection is optional only when the caller declares it optional.
- ImageUpload awaits async persistence for upload/removal and catches the callback's failure.
- Pagination supports known/unknown totals. Generic list and report tables have named, focusable scroll regions. Row actions include record context. Dental charts share FDI data and retain usable scrollable targets.
- Obsolete generic settings/user renderers were removed only after confirming the dedicated components return first. Existing Employees and SettingsPanel remain authoritative.

## Phase 4 implementation

Files: `shell.tsx`, `workspace.tsx`, `erp.css`.

- Header search owns its height instead of inheriting broad form sizing. Browser measurement confirms header **80px** at every required width/theme; visible search is **44px**.
- Closed mobile sidebar is inert and hidden; open sidebar contains keyboard focus, makes background inert, supports Escape, prevents background scrolling and restores focus. Existing navigation role lists drive the frontend unauthorized-section state. Server authorization is untouched.
- Page heading/actions precede dashboard/roster content. Existing sidebar expanded/collapsed/mobile widths remain 256/96/280px.

## Phase 5 page batches

- Public/auth: request errors and retry separated from empty catalogues, keyed availability/suggestions, retained booking payloads, explicit auth labels, focused errors, neutral approval-policy copy, route titles and localized error/not-found recovery.
- Clinical: named scrollable lists, contextual actions, retained mutation data, abortable patient details with retry; distinct read/edit permissions and clinical payloads preserved.
- Scheduling/profile/employees: shared request states, retry, guarded schedule/week forms, retained appointment drafts across doctor/service/day changes, existing week presets and role scope retained; native employee disclosures close on Escape/focus exit.
- Finance/inventory/documents/reports/audit: totals/pagination semantics, readable scroll regions and clinic timestamp display; payment void/delete confirmations reuse existing Modal/EntityForm, including required reason and busy/error handling.
- Settings: successful initial read required before editing clinic/system policy. Telegram initial loading/error/retry uses the shared request lifecycle. Failed reads cannot write fallback defaults.

## QA so far (not final sign-off)

- TypeScript passes after implementation slices.
- ESLint: 0 errors; two unchanged backend unused-variable warnings. Generated `.open-next` output is excluded; lint rules remain enabled.
- Existing unit tests: 15/15 pass. First sandboxed invocation failed because tsx requires a local IPC socket; authorized rerun passed.
- Existing isolated workflow/RBAC suite: pass, using temporary PGlite and mocked Telegram. Native PostgreSQL concurrency/real delivery remain outside that suite.
- Production Next/OpenNext build: pass; baseline prerender `ERP request failed: Error` and ExcelJS `axisIndex` bundle warning remain. Final source verification/build will be rerun after QA fixes.
- Responsive initial full-page matrix: 80 public/auth and 656 staff renders in light/dark; no document overflow or JavaScript errors. Additional create-dialog matrix: **176/176** geometry/name/label checks passed across all eight widths and both themes.
- Focused interactions passed: mobile focus/inert/Escape; new-patient appointment payload and retained draft; mutation failure retains table; settings failure blocks editing and retry restores; unauthorized doctor reports; dirty dismissal keeps edits until discard.
- `bun run test:e2e` attempted: blocked at configuration guard because `ERP_TEST_DATABASE_URL` is absent. No authenticated E2E cases ran; no production DB was used. This remains a release-validation gate.

## QA fixes and review follow-up

- Added reproducible `scripts/test-ui-responsive.mjs`, using the real public routes plus real staff TSX components with isolated navigation/API adapters. It never submits to a clinic DB. It can run all checks, only dialogs, or only interactions; see DESIGN_SYSTEM.md for commands.
- Added delayed-response tests: an old search cannot replace a newer result; pending mutation cannot be closed/discarded. Checked weekly preset payload, patient detail loading, payment void reason and upload persistence failure.
- Contrast follow-up: normalized supporting text to existing semantic colors. Five audited secondary text pairs now measure 4.60–5.36:1 in light and 7.34–8.84:1 in dark. Removed the inherited brightness filter on dark badges; corrected employee-name/Telegram surfaces at their owners.
- Calendar buttons retain their native Enter/Space selection and now support Arrow/Home/End focus movement across visible days. No recurrence, dates or availability calculations changed.
- Final long-name testing found mobile footer implicit grid minima could stretch the document. Fixed grid tracks/child minimum sizing; recheck in progress. This was a real QA failure, not a passed test.
- Input owner rules now consume the shared minimum height, border, radius and text tokens. The global search retains its own sizing to avoid the original header regression.
- Protected-file hashes rechecked: **39 API/library/schema/dependency files unchanged** from the start of this task.
- Existing authenticated E2E selector reviewed: the service edit test now expects the record-specific accessible name instead of generic “Засах”. Assertions and test coverage were retained; execution still needs the isolated test DB.

## Audit disposition

The numbered audit remains the historical baseline. “Implemented” below is a source/UI disposition, not a claim that every authenticated workflow passed.

| Finding | Implementation / remaining verification                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01–02   | CSS ownership/import consolidation and extracted design tokens; structural sidebar/header/control/modal/z-index values consume tokens                                                                        |
| 03      | Secondary text normalized and measured; employee dark text/surfaces corrected; explicit on-accent foreground preserves dark primary-button readability. Full WCAG/screen-reader certification is not claimed |
| 04      | Removed obsolete hero selectors (retained the still-used logo rule) and unused icon branches                                                                                                                 |
| 05–08   | Header composition, mobile focus lifecycle, frontend role guard and heading-before-roster layout implemented                                                                                                 |
| 09–11   | Named native dialog, common padding, focus return and independent busy/dirty form guards implemented                                                                                                         |
| 12–14   | Optional patient path, explicit shared-form labels/hints/errors and auth error focus implemented; exhaustive role-specific validation still requires authenticated E2E                                       |
| 15–17   | Native controls/token dimensions, shared Button variants, 44px modal/dental targets implemented; intentional hero/native calendar patterns retained                                                          |
| 18–20   | Contextual row groups/actions, focusable table scroll regions, scoped column headers and known/unknown-total pagination implemented                                                                          |
| 21–23   | Aborted/identified GETs, separate load/action/detail/options errors, options retry and unavailable-create guard implemented                                                                                  |
| 24–26   | Skeleton/empty/error/retry states adopted across existing request owners; doctor/patient/profile detail retry and public catalogue failure presentation implemented                                          |
| 27–29   | Awaited image persistence, settings successful-read gate and shared message lifetime implemented                                                                                                             |
| 30      | Proven unreachable generic user/settings branches removed; dedicated modules retained                                                                                                                        |
| 31–32   | Native calendar grouping/current-day/keyboard focus and shared FDI data implemented; recurrence vs date and read vs edit renderers remain separate                                                           |
| 33      | Destructive/payment reason flows reuse Modal/EntityForm; employee actions retain accessible native disclosure with Escape/focus-exit dismissal                                                               |
| 34      | Datetime display uses clinic timezone helper; date-only inputs/values and business calculations unchanged                                                                                                    |
| 35–36   | Localized error/not-found recovery, page titles, initial saved/system theme script and consolidated mode ownership implemented                                                                               |
| 37–38   | Pending row controls, profile/system progress announcements, shared feedback lifetime and neutral approval-policy copy implemented                                                                           |
| 39      | Frontend lint errors/warnings resolved; two pre-existing backend warnings retained; generated output excluded                                                                                                |
| 40      | **Open release gate:** authenticated E2E cannot start without isolated `ERP_TEST_DATABASE_URL`; browser fixtures and isolated workflow tests do not replace it                                               |

## Final QA fixes

- Long clinic-name footer overflow: corrected mobile/tablet implicit grid minimums and child sizing. The added long-name checks now reach both 375px and 1440px.
- 375px report export action overflow: heading/action layout now wraps in its existing small-screen media rule. Empty service reports show the existing Empty state instead of an empty table header.
- Payment void reason now declares the existing endpoint's 3–500 character limits in the shared form. Server validation remains unchanged.

## Final status

Implementation and available QA are complete. Final full browser run passed: 80 public/auth pages, 656 staff pages, 176 dialogs, 16 long table-text and 2 long clinic-name checks, plus 13 interaction scenarios. No accidental document overflow or JavaScript errors remain in those samples. See [UI_UX_FINAL_REPORT.md](UI_UX_FINAL_REPORT.md) for exact results and limitations.

**Overall release sign-off remains incomplete:** authenticated E2E did not run because the isolated test database is not configured. This is the outstanding Definition of Done gate.

Final review follow-up: the confirmation explicitly names the original delete/deactivate operation. Rebuilt successfully, then re-ran focused checks against the local production preview: **14 scenarios pass**, including the unchanged deactivate DELETE endpoint. Evidence: `/private/tmp/bb-ui-final-interactions/results.json`.
