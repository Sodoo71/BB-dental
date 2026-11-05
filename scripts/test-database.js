// Isolated in-memory PostgreSQL-compatible relational tests. Never reads DATABASE_URL.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const directory = await mkdtemp(join(tmpdir(), "bb-dental-relational-"));
const database = await PGlite.create();
const server = new PGLiteSocketServer({ db: database, path: join(directory, ".s.PGSQL.5432") });
const pool = new Pool({ host: directory, port: 5432, user: "postgres", database: "bb_dental_test", max: 1, connectionTimeoutMillis: 5000 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
try {
  // Schema-only diff, never the configured datasource. The child cannot access production credentials.
  const sql = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"], { encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://localhost/unused", DIRECT_URL: "" }, stdio: ["ignore", "pipe", "pipe"] });
  await database.exec(sql);
  await server.start();
  mock.module("../lib/prisma", () => ({ prisma }));
  mock.module("../lib/auth", () => ({ requireRole: async () => ({ id: "test-admin", role: "ADMIN" }) }));
  mock.module("../lib/telegram", () => ({ notifyDoctorOnTelegram: async () => false }));
  const { changeAppointmentStatus } = await import("../lib/appointments/service");
  const { DELETE: archiveService } = await import("../app/api/services/route");
  const { POST: registerPatient } = await import("../app/api/patients/route");
  const service = await prisma.service.create({ data: { name: "Test service", slug: "test", category: "GENERAL", price: 50000, durationMin: 30 } });
  const doctor = await prisma.doctor.create({ data: { name: "Test doctor", specialty: "General" } });
  const patient = await prisma.patient.create({ data: { fullName: "Test patient", phone: "99112233" } });
  const day = new Date("2099-01-02T00:00:00Z");
  await prisma.doctorSchedule.create({ data: { doctorId: doctor.id, dayOfWeek: day.getUTCDay(), startTime: "09:00", endTime: "18:00" } });
  const base = { patientName: patient.fullName, patientPhone: patient.phone, patientId: patient.id, doctorId: doctor.id, serviceId: service.id, appointmentDate: day, startTime: "10:00", endTime: "10:30" };
  const cancelled = await prisma.appointment.create({ data: { ...base, status: "CANCELLED" } });
  const occupied = await prisma.appointment.create({ data: { ...base, status: "CONFIRMED" } });
  await prisma.appointmentNote.create({ data: { appointmentId: occupied.id, note: "Historical clinical note" } });
  await assert.rejects(changeAppointmentStatus({ id: "test-admin", role: "ADMIN" }, cancelled.id, "CONFIRMED"), error => error.status === 409);
  assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: cancelled.id } })).status, "CANCELLED", "conflict rolls back");
  await changeAppointmentStatus({ id: "test-admin", role: "ADMIN" }, occupied.id, "CANCELLED");
  assert.equal(await prisma.appointmentNote.count({ where: { appointmentId: occupied.id } }), 1, "cancellation preserves notes");
  await changeAppointmentStatus({ id: "test-admin", role: "ADMIN" }, cancelled.id, "CONFIRMED");
  assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: cancelled.id } })).status, "CONFIRMED");
  const duplicate = await registerPatient(new Request("http://localhost/api/patients", { method: "POST", body: JSON.stringify({ fullName: "Wrong replacement", phone: patient.phone }) }));
  assert.equal(duplicate.status, 409);
  assert.equal((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).fullName, "Test patient");
  const archived = await archiveService(new Request("http://localhost/api/services", { method: "DELETE", body: JSON.stringify({ serviceId: service.id }) }));
  assert.equal(archived.status, 200);
  assert.equal(await prisma.appointment.count(), 2);
  assert.equal(await prisma.appointmentNote.count(), 1);
  assert.equal((await prisma.service.findUniqueOrThrow({ where: { id: service.id } })).isActive, false);
  assert.equal(await prisma.auditLog.count(), 3);
  console.info("PASS isolated Prisma/PGlite relational workflows: conflict rollback, reactivation, cancellation/note retention, duplicate patient protection, service archival and transactional audits.");
  console.info("PGlite is single-connection; native PostgreSQL concurrency and production migration rehearsal remain unverified.");
} finally {
  mock.restore();
  await prisma.$disconnect();
  await pool.end();
  await server.stop();
  await database.close();
  await rm(directory, { recursive: true, force: true });
}
