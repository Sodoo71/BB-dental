// Compatibility entry point retained for old runbooks. Historical migration state is unknown.
console.error("This legacy rollout command is disabled: its additive migration is absent and the recorded migration chain can destroy historical values. Inspect the actual database with bun scripts/inspect-database.ts, reconcile a staging copy, and approve a forward-only migration before deployment.");
process.exitCode = 1;
export {};
