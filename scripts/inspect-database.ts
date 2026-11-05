import "dotenv/config";
import { Client } from "pg";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for read-only inspection.");
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout = '10s'");
  const { rows } = await client.query<{ table_name: string; column_name: string }>("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position");
  const tables: Record<string, string[]> = {};
  for (const row of rows) (tables[row.table_name] ??= []).push(row.column_name);
  if (process.argv.includes("--audit")) {
    const roles = await client.query('SELECT role, status, COUNT(*)::int AS count FROM "User" GROUP BY role, status ORDER BY role, status');
    const migrations = tables._prisma_migrations ? await client.query('SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY started_at') : { rows: [] };
    const constraints = await client.query("SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conrelid::regclass::text, conname");
    const indexes = await client.query("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname");
    const start = performance.now();
    await client.query('SELECT 1');
    console.info(JSON.stringify({ roles: roles.rows, migrations: migrations.rows, constraints: constraints.rows, indexes: indexes.rows, warmSelect1Ms: Math.round(performance.now() - start) }, null, 2));
  } else
  if (process.argv.includes("--verify-security")) {
    for (const table of ["Session", "AuthRateLimit", "AuditLog"]) {
      if (!tables[table]) throw new Error("Missing security table");
    }
    if (!tables.User?.includes("status")) throw new Error("Missing account state");
    const inconsistent = await client.query(`SELECT COUNT(*)::int AS count FROM "User" WHERE "isActive" <> ("status" = 'ACTIVE')`);
    if (inconsistent.rows[0].count !== 0) throw new Error("Account state mismatch");
    console.info("Security tables and account-state backfill verified.");
  } else console.info(JSON.stringify(tables, null, 2));
} catch { console.error("Database schema inspection failed."); process.exitCode = 1; }
finally { await client.query("ROLLBACK").catch(() => {}); await client.end(); }
