# Implemented increment: security foundation

## Delivered

- Inspected framework, package manifest, Prisma models, API/authentication, UI and environment names. Preserved unrelated existing work. Plan: IMPLEMENTATION_PLAN.md.
- Added and applied an additive PostgreSQL upgrade for account states, reception role, opaque sessions, shared authentication counters and audit logs. Verified table presence and account-state consistency using read-only queries.
- Replaced indefinitely valid signed-ID cookies with hashed random session tokens, 12-hour server expiry, server logout revocation, and revocation on staff/password changes.
- Retained compatibility with existing scrypt passwords and bcrypt reset passwords. New password hashes use asynchronous scrypt and random salts.
- Added Zod validation, normalized email, 12-character new-password minimum, login/registration throttling and generic server errors.
- Added approval/rejection/suspension and automatic approval policy, including doctor-profile creation in a transaction. Public registration permits DOCTOR and RECEPTION only. Staff responses use explicit safe projections, never password hashes.
- Added permission checks, privileged-account protection and serialized staff administration with actor revalidation. Existing ADMIN and SUPER_ADMIN can use administrative/reception modes; doctor mode requires a linked doctor profile. RECEPTION cannot manage staff/settings.
- Added persisted audit records and replaced reconstructed activity events in the log endpoint with actual audit rows.
- Migrated deprecated middleware to Next.js proxy and added same-origin mutation checks.
- Removed the public admin password-reset/bootstrap behavior. Added local initial-admin provisioning that refuses to overwrite existing administrators.
- Removed embedded Cloudinary/Telegram credentials, stopped returning Telegram credentials from settings/backups, and added authenticated Telegram webhook checks. Removed insecure doctor-ID-only Telegram account binding and restricted callbacks/commands to linked active doctors.
- Removed the unauthenticated notification-only booking relay. The existing persisted appointment route remains the booking entry point.
- Enforced raster allowlist/signature checks and an 8 MB image limit; removed the base64 database fallback. Updated image UI to match. These are public profile/service uploads, not a private medical-file solution.
- Restricted appointment notes and legacy transfer/reminder actions to authorized staff and assigned doctors; added bounded note validation, pagination and note audit records.
- Added staff pagination, reception registration, status/rejection/suspension controls, approval results and mode navigation.

## Verified

- Baseline and final TypeScript checks.
- Prisma schema validation and client generation.
- Optimized Next.js production build.
- Focused ESLint error checks for the security implementation.
- 13 automated security regression cases: legacy/new passwords, role/state policy, administrative privilege protection, origin checks, opaque tokens, registration constraints, file signatures, server session expiry and disabled-account rejection.
- 13 local production-route smoke checks: login/registration pages, protected-dashboard redirects, unauthenticated API denials, cross-origin denial, invalid-input validation, blocked administrator self-registration, webhook authentication and disabled public bootstrap.
- Read-only verification after the live additive security upgrade: expected security tables and no inconsistent account state/isActive pairs.
- Credential-pattern source scan found no remaining embedded Telegram/Cloudinary credentials in app/lib/components/scripts. This is not a full secret-scanner or repository-history audit.

No valid account credentials were exercised in smoke tests. No test patient/appointment records were created. No Telegram messages were sent. No Cloudinary upload was sent. No browser/mobile visual QA or isolated database concurrency tests were performed.

## Required configuration and operational follow-up

See SECURITY_ROLLOUT.md. Set APP_URL for production. Rotate the previously exposed Telegram token and Cloudinary API secret. Register a Telegram webhook secret. Reconcile legacy migration history before future migration deployment or a fresh installation. The targeted upgrade was applied without falsely marking historical migrations complete. Schedule expired-session/counter cleanup and configure edge request-size/IP limits.

## Remaining scope

The full ERP acceptance criteria are not complete. Major remaining work includes comprehensive patient profiles/treatments, private medical storage, accepted/rejected patient transfers, internal patient chat/read receipts, clinic hours/recurring breaks, unified transaction-safe appointment updates and database overlap constraints, checkout/payment snapshots, durable privacy-minimized notifications/deep links, complete CMS/analytics validation, and responsive/accessibility/integration QA. Some legacy APIs still use their original validation/business logic and need the later hardening phase. The existing transfer route remains immediate appointment reassignment, not the requested transfer lifecycle.
