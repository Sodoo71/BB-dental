# BB Dental UI update

The public site, authentication screens, administrative/reception screens and doctor screens now share navy/gold branding, Inter UI typography and Merriweather headings. Font files are bundled locally, including extended Cyrillic characters used in Mongolian.

## Changes

- Redesigned public landing hero and login/registration layouts; preserved existing booking and form actions.
- Unified administrative navigation and added a responsive doctor shell with current-page navigation, profile access and a mobile drawer.
- Standardized cards, tables, form controls, typography, spacing, focus indicators and reduced-motion behavior across existing pages.
- Replaced overlay divs with reusable native modal dialogs. Added keyboard focus containment, Escape dismissal, focus restoration and viewport-bounded scrolling.
- Added accessible mobile drawers, user-menu dismissal, skip links, loading/error/not-found states and screen-reader toast announcements.
- Added a compact mobile doctor calendar; desktop retains the detailed month grid.
- Fixed narrow-screen overflow in audit entries and settings controls; tables scroll inside their own containers.
- Added missing image fallbacks and aligned the image picker with supported upload formats.
- Removed the inactive notification button in favor of a working audit-history link.
- Grouped reception appointment actions under a three-dot menu, retaining status-specific actions. The native popover stays above scrolling tables, supports arrow/Home/End keys, Escape/outside dismissal and focus restoration when opening dialogs.
- Standardized dashboard cards to 16 px padding and grid gaps, reduced chart height and replaced doctor workload tiles with compact rows in a bounded scrolling list.

## Verification

TypeScript, optimized production build and focused lint checks passed. Browser checks passed at 390 px, 768 px and 1440 px across five public routes and eight authenticated administrative/reception routes, with no page-level horizontal overflow or browser JavaScript errors. Mobile navigation and the user, service and doctor dialogs passed keyboard focus containment, Escape dismissal and focus restoration checks at 390 × 844. These checks are exercised by scripts/check-ui.ts. The configured administrator is not linked to a doctor profile, so signed-in doctor routes cannot be checked with that account; their changes are covered by TypeScript/build checks, not an end-to-end doctor session.

Use Node for Playwright here: Bun's HTTP client failed to process a secure session-cookie response correctly during testing.

```sh
node --experimental-strip-types scripts/check-ui.ts --staff --serve
node --experimental-strip-types scripts/check-ui.ts --staff --tablet-only --serve
```

The script reads existing SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD only when --staff is passed. It does not save forms or modify clinic records. It logs out and stops its temporary server afterward. Local screenshots are stored in artifacts/ui, which is gitignored because authenticated screenshots may include clinic data.

No backend business workflows or database schema were changed in this UI increment.

The action-menu/card follow-up passed production build, focused lint and whitespace checks. Dashboard layouts were checked with browser-only sample data at 390/768/1440 px; isolated menu checks at 390/660/768/1024/1440 px covered viewport bounds, keyboard navigation, dismissal, action callbacks and dialog focus restoration. These are UI checks, not live database mutation tests.
