import "dotenv/config";
import { Client } from "pg";
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  const { rows } = await client.query<{ table_name: string; column_name: string }>("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position");
  const tables: Record<string, string[]> = {};
  for (const row of rows) (tables[row.table_name] ??= []).push(row.column_name);
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
finally { await client.end(); }
