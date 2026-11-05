// Local in-memory migration rehearsal only. Never reads a configured database URL.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { hashPassword, verifyPassword } from "../lib/auth/password";

const directory = await mkdtemp(join(tmpdir(), "bb-role-migration-"));
const database = await PGlite.create();
const server = new PGLiteSocketServer({ db: database, path: join(directory, ".s.PGSQL.5432") });
const pool = new Pool({ host: directory, port: 5432, user: "postgres", database: "bb_role_test", max: 1, connectionTimeoutMillis: 5000 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
try {
  // Pin the pre-migration schema, avoiding accidental tests against an already-expanded enum.
  const schema = execFileSync("git", ["show", "3335f04:prisma/schema.prisma"], { encoding: "utf8" });
  const schemaFile = join(directory, "legacy.prisma");
  await writeFile(schemaFile, schema);
  const sql = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema", schemaFile, "--script"], { encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://localhost/unused", DIRECT_URL: "" }, stdio: ["ignore", "pipe", "pipe"] });
  await database.exec(sql);
  await server.start();
  const passwordHash = await hashPassword("isolated-test-password");
  const doctor = await prisma.doctor.create({ data: { name: "Fixture doctor", specialty: "General" } });
  const roles = ["SUPER_ADMIN", "SUPER_ADMIN", "ADMIN", "PATIENT", "DOCTOR", "RECEPTION"];
  const users = [];
  for (const [index, role] of roles.entries()) users.push(await prisma.user.create({ data: {
    email: `fixture-${index}@example.test`, name: `Fixture ${index}`, passwordHash, role,
    status: role === "DOCTOR" ? "SUSPENDED" : "ACTIVE", isActive: role !== "DOCTOR",
    ...(role === "DOCTOR" ? { doctorId: doctor.id } : {}),
  } }));
  mock.module("../lib/prisma", () => ({ prisma }));
  let activeCookie = "";
  mock.module("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: activeCookie }) }) }));
  mock.module("../lib/security/rate-limit", () => ({ rateLimit: async () => {} }));
  const { POST: login } = await import("../app/api/auth/login/route");
  const { sessionUser, requireRole } = await import("../lib/auth");
  const adminCookies = [];
  for (const admin of users.slice(0, 2)) {
    const response = await login(new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: admin.email, password: "isolated-test-password" }) }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.role, "ADMIN", "legacy admin login emits canonical role");
    activeCookie = response.headers.get("set-cookie").match(/smilecare_session=([a-f0-9]{64})/)[1];
    adminCookies.push(activeCookie);
    assert.equal((await sessionUser()).role, "ADMIN");
  }
  const sessionCount = await prisma.session.count();
  const stableFields = user => Object.fromEntries(Object.entries(user).filter(([key]) => key !== "role"));
  const before = (await prisma.user.findMany({ orderBy: { id: "asc" } })).map(stableFields);
  const expand = await readFile("prisma/migrations/20261105000100_expand_user_role/migration.sql", "utf8");
  const convert = await readFile("prisma/migrations/20261105000200_map_four_primary_roles/migration.sql", "utf8");
  await database.exec(expand);
  await database.exec(convert);
  const after = await prisma.user.findMany({ orderBy: { id: "asc" } });
  assert.deepEqual(after.map(stableFields), before, "IDs, credentials, account states, doctor links and timestamps preserved");
  assert.equal(after.filter(user => user.role === "ADMIN").length, 3);
  assert.equal(after.find(user => user.id === users[3].id).role, "USER");
  assert.equal(await prisma.session.count(), sessionCount, "existing sessions survive conversion");
  for (const cookie of adminCookies) { activeCookie = cookie; assert.equal((await requireRole("ADMIN")).role, "ADMIN"); }
  const publicLogin = await login(new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: users[3].email, password: "isolated-test-password" }) }));
  assert.equal(publicLogin.status, 200);
  assert.equal((await publicLogin.json()).data.role, "USER");
  activeCookie = publicLogin.headers.get("set-cookie").match(/smilecare_session=([a-f0-9]{64})/)[1];
  assert.equal(await requireRole("ADMIN"), null);
  assert.equal(await requireRole("RECEPTION"), null);
  assert.equal(await requireRole("DOCTOR"), null);
  assert.equal(await prisma.auditLog.count({ where: { action: "ROLE_MIGRATED" } }), 3);
  for (const admin of after.filter(user => user.role === "ADMIN")) assert.equal(await verifyPassword("isolated-test-password", admin.passwordHash), true);
  for (const legacyRole of ["SUPER_ADMIN", "PATIENT"]) await assert.rejects(prisma.user.create({ data: { email: `${legacyRole}@example.test`, name: "Rejected legacy assignment", passwordHash, role: legacyRole } }));

  mock.module("../lib/prisma", () => ({ prisma }));
  const { changeAccountState, preserveActiveAdministrator, lockUserAdministration } = await import("../lib/auth/users");
  const actor = { id: users[0].id, role: "ADMIN" };
  await assert.rejects(changeAccountState(actor, actor.id, "SUSPENDED"), error => error.status === 403);
  await changeAccountState(actor, users[1].id, "SUSPENDED");
  await changeAccountState(actor, users[2].id, "SUSPENDED");
  const last = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  await assert.rejects(prisma.$transaction(async tx => { await lockUserAdministration(tx, actor); await preserveActiveAdministrator(tx, last, { role: "DOCTOR" }); }), error => error.status === 409);
  for (const update of [{ role: "USER" }, { status: "SUSPENDED" }, { isActive: false }]) await assert.rejects(prisma.user.update({ where: { id: actor.id }, data: update }));
  await assert.rejects(prisma.user.delete({ where: { id: actor.id } }));
  assert.equal(await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE", isActive: true } }), 1);

  const unsafe = await PGlite.create();
  try {
    await unsafe.exec(sql);
    await unsafe.exec(expand);
    await unsafe.query('INSERT INTO "User" (id,email,name,"passwordHash",role,"updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())', ["only-patient", "only@example.test", "Fixture", "fixture-hash", "PATIENT"]);
    await assert.rejects(unsafe.exec(convert));
    await unsafe.exec("ROLLBACK");
    assert.equal((await unsafe.query('SELECT role FROM "User"')).rows[0].role, "PATIENT");
    assert.equal((await unsafe.query('SELECT COUNT(*)::int AS count FROM "AuditLog"')).rows[0].count, 0);
  } finally { await unsafe.close(); }
  console.info("PASS four-role migration: legacy mapping, credential/session/link/timestamp preservation, migration audits, rejected legacy writes, equal-admin management, last-admin protection, and rollback without an active admin.");
  console.info("Isolated PGlite rehearsal only; native PostgreSQL staging and production execution remain pending.");
} finally {
  mock.restore(); await prisma.$disconnect(); await pool.end(); await server.stop(); await database.close();
  await rm(directory, { recursive: true, force: true });
}
