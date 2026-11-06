# BB Dental design system

This normalizes the existing v2 appearance. It does not introduce a new visual identity.

## Ownership

Root layout imports `styles/design-tokens.css`, `globals.css`, `erp/erp.css`, then `v2-theme.css`. Public/auth components belong to globals, staff components to ERP, mode-specific rules to v2-theme, and the home hero to `components/home/hero.css`. Do not import ERP CSS from individual pages. Avoid new override sheets.

## Tokens

`app/styles/design-tokens.css` owns the palette, Inter body/Merriweather headings, weights 400/500/600/700, 4–48px spacing scale, 10px control/16px card radii, existing card/dialog shadows, 44px controls, 48px auth controls, 80px header, 256/96px desktop sidebar, 280px (88vw maximum) mobile sidebar and 660px dialogs. Background, surface, ink, muted and border tokens follow the theme. Brand remains #007779, deep #005f62 and accent #85ded3.

Media query thresholds remain literal values; `--breakpoint-*` document the 600/900/1100px thresholds because custom properties cannot be used inside CSS media conditions. Existing feature-specific breakpoints remain until independently verified.

## Shared components

Extend `app/erp/ui.tsx` rather than creating parallel primitives. Native dialog provides top-layer placement and browser focus containment; title is connected with `aria-labelledby`. EntityForm controls have stable IDs, explicit labels, linked hints/validation, native constraints and focused submission errors. PatientPicker inherits the field's required flag. Buttons support primary, secondary, outline, ghost and destructive variants and disabled/busy states. Pagination accepts an optional server total; absent totals are never inferred from current page length. Feedback and LoadingSkeleton cover inline request states.

Use a labelled, focusable scroll region for wide tables. Preserve readable columns on phones. Keep icon controls at least 44px and preserve dental diagram dimensions with horizontal scrolling. Loading, errors, empty results and mutation feedback must remain distinct; an action failure must not erase the current list.

ImageUpload waits for both upload and caller persistence, catches failures and holds busy state through either phase. Existing logo fallback, upload endpoint and role-specific data remain intact.

## Interaction conventions

`useModalGuard` registers each form independently, so notes, transfer forms and appointment selections cannot replace another form's pending state. Explicit save completion may close the dialog; Close/Cancel/Escape/backdrop go through the dirty/busy policy. Delete and payment void reuse the existing Modal/EntityForm, preserving endpoint, reason and validation requirements.

Use `useResource` for independent GET state, with URL/attempt identity, abort cleanup, loading, error and retry. Keep local mutation errors distinct from the page's load error. `useMessage` gives existing transient success feedback a shared four-second lifetime. Long-lived validation errors remain until corrected or retried.

Native calendar day buttons support Arrow/Home/End focus movement via `calendar-keyboard.ts`. Enter/Space choose the date/weekday using the caller's original handler. They remain native button groups, not incomplete ARIA grids. Native employee action disclosures use Tab, Escape and focus-exit dismissal; they are not labelled as ARIA menus.

## Browser verification

Start the app using the project's existing dev command. Then run:

```sh
UI_BASE_URL=http://localhost:3000 node scripts/test-ui-responsive.mjs
```

The base URL defaults to port 3111; `UI_QA_OUTPUT` chooses the artifact directory (default `/private/tmp/bb-ui-refactor`). `UI_QA_SLICE=dialogs` checks the 176 create-dialog combinations and focused interactions; `UI_QA_SLICE=interactions` runs the focused scenarios and long table text checks. Full mode covers five public/auth pages and every role-visible staff section at all eight widths in both themes, plus dialogs and long text.

Staff requests are fixtures, including mutations, delayed responses and failures. These are component/browser regressions, **not authenticated E2E**. The existing `bun run test:e2e` requires a separate localhost PostgreSQL database whose name ends in `_test`, configured through `ERP_TEST_DATABASE_URL`. Never substitute the clinic database.
