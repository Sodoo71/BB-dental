import "dotenv/config";
import { mock } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required.");
// PostgreSQL itself rejects mutations on every connection used by this benchmark.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, options: "-c default_transaction_read_only=on", connectionTimeoutMillis: 15000 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const directory = await mkdtemp(join(tmpdir(), "bb-availability-"));
try {
    const readOnly = await pool.query("SHOW default_transaction_read_only");
    if (readOnly.rows[0].default_transaction_read_only !== "on")
        throw new Error("Read-only mode is required.");
    mock.module("../lib/prisma", () => ({ prisma }));
    const baselineRef = process.argv[2] || "29be91d";
    const source = execFileSync("git", ["show", `${baselineRef}:app/api/availability/suggest/route.ts`], { encoding: "utf8" });
    const baselineFile = join(directory, "baseline.ts");
    // Use absolute module paths so the temporary reference resolves the same application helpers.
    await writeFile(baselineFile, source.replaceAll('"@/', `"${process.cwd()}/`));
    const { GET: before } = await import(baselineFile);
    const { GET: after } = await import("../app/api/availability/suggest/route");
    const [doctor, service] = await Promise.all([
        prisma.doctor.findFirst({ where: { isActive: true }, select: { id: true }, orderBy: { id: "asc" } }),
        prisma.service.findFirst({ where: { isActive: true }, select: { id: true }, orderBy: { id: "asc" } }),
    ]);
    if (!doctor || !service)
        throw new Error("Active doctor and service are required.");
    const url = `http://localhost/api/availability/suggest?${new URLSearchParams({ doctorId: doctor.id, serviceId: service.id })}`;
    const results = { before: [], after: [] };
    for (let run = 0; run < 3; run++) {
        for (const [name, handler] of [["before", before], ["after", after]]) {
            const start = performance.now();
            const response = await handler(new Request(url));
            if (!response.ok)
                throw new Error(`Handler failed with status ${response.status}.`);
            await response.json();
            results[name].push(Math.round(performance.now() - start));
        }
    }
    console.info(JSON.stringify({ baselineRef, measurement: "direct GET handler including database reads; excludes HTTP transport", readOnly: true, runsMs: results }, null, 2));
}
catch {
    console.error("Read-only availability benchmark failed; no clinic data or connection string logged.");
    process.exitCode = 1;
}
finally {
    mock.restore();
    await prisma.$disconnect();
    await pool.end();
    await rm(directory, { recursive: true, force: true });
}
