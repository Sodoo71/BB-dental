import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
// Targeted additive upgrade for the inspected legacy database, which has no Prisma history.
// Deliberately does not mark old migrations applied or recreate business tables.
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
try {
  const sql = await readFile(new URL("../prisma/migrations/20260924000000_staff_security/migration.sql", import.meta.url), "utf8");
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL statement_timeout = '60s'");
  await client.query("SELECT pg_advisory_xact_lock(82173642)");
  const existing = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'status'");
  if (existing.rowCount) throw new Error("Account state already exists; inspect migration state before proceeding.");
  await client.query(sql);
  await client.query("COMMIT");
  console.info("Security upgrade applied: account states, sessions, rate limits, audit log. Business records preserved.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(error instanceof Error && error.message.startsWith("Account state") ? error.message : "Security upgrade failed and was rolled back. Inspect database connectivity/schema.");
  process.exitCode = 1;
} finally { await client.end(); }
