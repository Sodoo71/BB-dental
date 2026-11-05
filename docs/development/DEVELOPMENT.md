# Development

## Baseline and Git

Work began on `1-v2-start` at `29be91d`. The requested `feature/bb-dental-v2` branch was created; the workspace was subsequently switched to `bb-dental-v2` during the session, and implementation commits remain on that user-selected branch. The user's pre-existing `package-lock.json` change was saved as `/private/tmp/bb-dental-v1-package-lock.patch`; the baseline SHA is also recorded in `/private/tmp/bb-dental-v1-head.txt`. These temporary files are session recovery aids, not durable backups. Existing Git history remains the source recovery point. Do not commit the user's unrelated npm lockfile patch with V2 changes.

Use logical commits and preserve working features. Before deleting source, check static/dynamic imports, framework route conventions, package scripts, runtime URLs and operational use. No existing application source files or migration files were deleted in this increment. The old profile URL remains as a re-export. The old rollout command remains as a fail-closed compatibility entry point.

## Conventions

- Read installed Next.js guides before changing framework APIs; this checkout uses Next 16 proxy and asynchronous route params.
- Validate input with shared Zod schemas. Keep server authorization and response allowlists explicit.
- Put repeated transaction/state rules in `lib/appointments`; keep existing hooks/components where they are useful.
- Keep money estimates distinct from financial transactions. Do not fabricate missing historical prices or financial balances.
- Record changes transactionally in audit logs without passwords, tokens, OTPs or secret environment values.
- Bound new list endpoints with pagination. Do not silently cap existing full-list contracts without migrating their UI.
- Store clinic calendar dates consistently and use `Asia/Ulaanbaatar` to determine the current clinic date.

## Dependencies

Bun is authoritative. Unreferenced `axios`, `express`, `jsonwebtoken`, Cloudinary SDK and `ts-node` were removed from the manifest and `bun.lock` after source/script/config searches. The app already uses fetch-based HTTP APIs, opaque sessions, and a custom Cloudinary signing implementation. Prisma's seed command is now configured in `prisma.config.ts` and uses Bun. Existing dependency versions were not upgraded. The npm lockfile remains the user's file; it is not the release install input.

Unused icon imports were removed using ESLint findings. Three image call sites reuse `ClinicImage`, preserving legacy media URLs and fallback behavior. Other uncertain hooks/assets/models remain; lack of a direct import alone is not deletion evidence.

## Quality checks

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test tests
bun run test:database
bun run test:roles
bun run build
# Start a local server separately, then:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101 bun run test:e2e
```

Tests under `tests/` cover auth/policy/timezones and isolated mocked API handlers. Mock fixtures run in a subprocess to avoid leaking Prisma/auth mocks across suites. They test behavior, not PostgreSQL lock scheduling. Production seed refusal is tested by invoking the actual script with production NODE_ENV before any connection.

The four Playwright booking tests mock API responses and cover service/doctor prefill, required phone confirmation, error recovery, conflicting slots and screen widths. They never create appointments in the clinic database.

`bun run test:database` creates an in-memory PGlite instance and a temporary Unix socket, generates the current schema with a schema-only Prisma diff, then runs actual Prisma transaction/constraint operations. It never reads production DATABASE_URL; the schema-diff child receives an unused localhost URL. Authentication/provider mocks only supply test identity and prevent notifications. Conflict rollback, reactivation, cancellation/note retention, duplicate patient protection, service archival and transactional audits passed.

PGlite and its socket helper are exact-version development dependencies already present through Prisma. Its single-connection behavior cannot prove native PostgreSQL concurrency. Docker was not running, so native multi-connection tests and staging migration rehearsal remain blocked. Do not point mutation/concurrency tests at DATABASE_URL. TEST_DATABASE_URL is reserved for a separate isolated database.

## Read-only performance comparison

`bun scripts/benchmark-availability.js 29be91d` compares the original and current suggestion handlers, three runs each. Every connection enforces `default_transaction_read_only=on`; output includes timings only. It chooses one active doctor/service and does not issue writes. This measures direct handler/database work, not HTTP transport or a production percentile. Review access before running against a clinic environment.

Measured 2026-11-05: baseline suggestion handler 1416/1080/1354 ms; optimized handler 842/250/222 ms. Median of three: 1354 → 250 ms (about 81.5% lower). Same active doctor/service, sequential before/after pairs and pooled read-only connections. Small sample; no HTTP transport, no cold-start distribution, no production SLO claim. The baseline route was loaded from 29be91d while using the current shared availability helpers.

`bun run test:roles` rehearses the approved expansion/conversion SQL against a synthetic legacy schema in PGlite. It also exercises actual login/session continuity and last-admin guards. It does not connect to production, prove native multi-connection behavior or authorize production deployment.
