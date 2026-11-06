// Isolated relational verification. No clinic datasource or Telegram is contacted.
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

process.env.DATABASE_URL = "postgresql://localhost/isolated_unused";
process.env.DIRECT_URL = "";
process.env.TELEGRAM_BOT_TOKEN = "";
const directory = await mkdtemp(join(tmpdir(), "bb-v2-workflows-"));
const database = await PGlite.create();
const server = new PGLiteSocketServer({
  db: database,
  path: join(directory, ".s.PGSQL.5432"),
});
const pool = new Pool({
  host: directory,
  port: 5432,
  user: "postgres",
  database: "bb_dental_test",
  max: 1,
  connectionTimeoutMillis: 5000,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
try {
  const migrations = (
    await readdir("prisma/migrations", { withFileTypes: true })
  )
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const migration of migrations) {
    if (migration === "202611060004_leave_workflow") {
      await database.exec(
        `INSERT INTO "Doctor" (id,name,specialty) VALUES ('legacy-doctor','Legacy','General'); INSERT INTO "Leave" (id,"doctorId",date,reason) VALUES ('legacy-leave','legacy-doctor','2099-01-01','Existing leave');`,
      );
    }
    await database.exec(
      await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  }
  assert.equal(
    (
      await database.query('SELECT status FROM "Leave" WHERE id=$1', [
        "legacy-leave",
      ])
    ).rows[0].status,
    "APPROVED",
  );
  await server.start();
  // Force a non-UTC session so expiry comparisons remain covered on UTC CI hosts.
  await prisma.$executeRaw`SET TIME ZONE 'Etc/GMT-8'`;
  mock.module("../lib/db", () => ({
    db: prisma,
    databaseConfigured: () => true,
  }));
  const { saveLeave, saveWeek, reviewLeave, weekSchema } =
    await import("../lib/schedule-actions");
  const { availability } = await import("../lib/booking");
  const { earliestAvailability } =
    await import("../lib/availability-suggestions");
  const { exportClinicData } = await import("../lib/data-export");
  const { registerAccount } = await import("../lib/accounts");
  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      phone: "99110001",
      role: "ADMIN",
      passwordHash: "EXCLUDED_PASSWORD",
    },
  });
  const staff = await prisma.user.create({
    data: {
      name: "Doctor",
      phone: "99110002",
      role: "DOCTOR",
      passwordHash: "EXCLUDED_PASSWORD",
    },
  });
  const doctor = await prisma.doctor.create({
    data: {
      name: "Doctor",
      specialty: "General",
      userId: staff.id,
      telegramChatId: "EXCLUDED_CHAT",
    },
  });
  const actor = { id: staff.id, role: "DOCTOR", doctor: { id: doctor.id } };
  const other = await prisma.doctor.create({
    data: { name: "Other", specialty: "General" },
  });
  const service = await prisma.service.create({
    data: {
      name: "Visit",
      category: "General",
      price: 45000,
      duration: 30,
      doctorIds: [doctor.id],
    },
  });
  const patient = await prisma.patient.create({
    data: { name: "Patient", phone: "99110003" },
  });
  const date = "2099-01-05";
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const days = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    off: false,
    startTime: "09:00",
    endTime: "18:00",
  }));
  await saveWeek(weekSchema.parse({ doctorId: doctor.id, days }), admin.id);
  assert.equal(
    await prisma.schedule.count({ where: { doctorId: doctor.id } }),
    7,
  );
  assert.throws(() =>
    weekSchema.parse({
      doctorId: doctor.id,
      days: days.map((d) => ({ ...d, weekday: 1 })),
    }),
  );
  const pending = await saveLeave(
    {
      doctorId: doctor.id,
      date,
      kind: "BLOCKED_RANGE",
      startTime: "10:00",
      endTime: "11:00",
      reason: "Request",
    },
    actor,
  );
  assert.equal(pending.status, "PENDING");
  assert.ok(
    (await availability(doctor.id, service.id, date, prisma)).includes("10:00"),
    "pending request cannot block booking",
  );
  await prisma.appointment.create({
    data: {
      doctorId: doctor.id,
      patientId: patient.id,
      serviceId: service.id,
      date,
      startTime: "10:00",
      endTime: "10:30",
      status: "CONFIRMED",
    },
  });
  await assert.rejects(
    reviewLeave(pending.id, "APPROVED", admin.id),
    (e) => e.status === 409,
  );
  assert.equal(
    (await prisma.leave.findUniqueOrThrow({ where: { id: pending.id } }))
      .status,
    "PENDING",
  );
  await reviewLeave(pending.id, "REJECTED", admin.id);
  await assert.rejects(
    reviewLeave(pending.id, "APPROVED", admin.id),
    (e) => e.status === 409,
  );
  const noConflict = await saveLeave(
    {
      doctorId: doctor.id,
      date,
      kind: "BLOCKED_RANGE",
      startTime: "12:00",
      endTime: "13:00",
      reason: "Lunch",
    },
    actor,
  );
  await reviewLeave(noConflict.id, "APPROVED", admin.id);
  assert.ok(
    !(await availability(doctor.id, service.id, date, prisma)).includes(
      "12:00",
    ),
  );
  await assert.rejects(
    saveLeave(
      { doctorId: other.id, date, kind: "DAY_OFF", reason: "Wrong doctor" },
      actor,
    ),
    (e) => e.status === 403,
  );
  await assert.rejects(
    saveLeave(
      {
        doctorId: doctor.id,
        date,
        kind: "BLOCKED_RANGE",
        startTime: "12:00",
        endTime: "13:00",
        reason: "Edit approved",
      },
      actor,
      noConflict.id,
    ),
    (e) => e.status === 403,
  );
  await assert.rejects(
    saveWeek(
      {
        doctorId: doctor.id,
        days: days.map((d) =>
          d.weekday === weekday
            ? { ...d, off: true }
            : { ...d, endTime: "17:00" },
        ),
      },
      admin.id,
    ),
    (e) => e.status === 409,
  );
  assert.equal(
    (
      await prisma.schedule.findUniqueOrThrow({
        where: { doctorId_weekday: { doctorId: doctor.id, weekday } },
      })
    ).endTime,
    "18:00",
    "weekly change rolls back atomically",
  );
  const overrideDate = "2099-01-06";
  await prisma.schedule.delete({
    where: {
      doctorId_weekday: {
        doctorId: doctor.id,
        weekday: new Date(`${overrideDate}T12:00:00Z`).getUTCDay(),
      },
    },
  });
  const override = await saveLeave(
    {
      doctorId: doctor.id,
      date: overrideDate,
      kind: "SCHEDULE_OVERRIDE",
      startTime: "14:00",
      endTime: "16:00",
      reason: "Extra working day",
    },
    actor,
  );
  assert.deepEqual(
    await availability(doctor.id, service.id, overrideDate, prisma),
    [],
  );
  await reviewLeave(override.id, "APPROVED", admin.id);
  assert.equal(
    (await availability(doctor.id, service.id, overrideDate, prisma))[0],
    "14:00",
  );
  await assert.rejects(
    saveLeave(
      {
        doctorId: doctor.id,
        date: overrideDate,
        kind: "SCHEDULE_OVERRIDE",
        startTime: "13:00",
        endTime: "15:00",
        reason: "Duplicate",
      },
      { id: admin.id, role: "ADMIN" },
    ),
    (e) => e.status === 409,
  );
  const suggestions = await earliestAvailability(
    service.id,
    undefined,
    overrideDate,
  );
  assert.equal(suggestions[0].doctorId, doctor.id);
  assert.equal(suggestions[0].startTime, "14:00");
  await prisma.setting.create({
    data: { key: "telegramBotTokenEncrypted", value: "EXCLUDED_TOKEN" },
  });
  const exported = await exportClinicData();
  const serialized = JSON.stringify(exported);
  for (const secret of [
    "EXCLUDED_PASSWORD",
    "EXCLUDED_CHAT",
    "EXCLUDED_TOKEN",
    "passwordHash",
    "tokenHash",
  ])
    assert.ok(!serialized.includes(secret));
  assert.equal(exported.appointments.length, 1);
  assert.equal(exported.leaves.length, 4);
  await prisma.setting.create({
    data: { key: "autoApproveDoctors", value: "true" },
  });
  const registration = {
    name: "Auto Doctor",
    phone: "99110004",
    email: "doctor@example.test",
    telegramChatId: "",
    password: "safe-test-password",
    requestedRole: "DOCTOR",
  };
  assert.equal(
    (await registerAccount(registration)).approvalStatus,
    "APPROVED",
  );
  assert.equal(
    (
      await registerAccount({
        ...registration,
        phone: "99110005",
        email: "desk@example.test",
        requestedRole: "RECEPTION",
      })
    ).approvalStatus,
    "PENDING",
  );
  const auth = await import("../lib/auth");
  let activeActor = { ...admin, doctor: null };
  mock.module("../lib/auth", () => ({
    ...auth,
    requireUser: async () => activeActor,
  }));
  const erp = await import("../app/api/erp/[...path]/route");
  const exportRoute = await import("../app/api/export/[kind]/route");
  const post = (path, data = {}) =>
    erp.POST(
      new Request(`http://localhost/api/erp/${path.join("/")}`, {
        method: "POST",
        headers: {
          Origin: "http://localhost",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }),
      { params: Promise.resolve({ path }) },
    );
  activeActor = { ...staff, role: "RECEPTION", doctor: null };
  assert.equal(
    (await post(["leave-review", noConflict.id], { status: "APPROVED" }))
      .status,
    403,
  );
  assert.equal(
    (await post(["schedule-week"], { doctorId: doctor.id, days })).status,
    403,
  );
  assert.equal(
    (
      await erp.GET(new Request("http://localhost/api/erp/system-status"), {
        params: Promise.resolve({ path: ["system-status"] }),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await exportRoute.GET(new Request("http://localhost/api/export/data"), {
        params: Promise.resolve({ kind: "data" }),
      })
    ).status,
    403,
  );
  const appointment = await prisma.appointment.findFirstOrThrow();
  assert.equal(
    (await post(["appointment-reminder", appointment.id])).status,
    403,
  );
  activeActor = { ...staff, doctor: { id: other.id, imageUrl: "" } };
  assert.equal(
    (await post(["appointment-reminder", appointment.id])).status,
    404,
  );
  activeActor = { ...staff, doctor: { id: doctor.id, imageUrl: "" } };
  await prisma.setting.delete({ where: { key: "telegramBotTokenEncrypted" } });
  process.env.TELEGRAM_BOT_TOKEN = "qa-isolated-token";
  const previousFetch = globalThis.fetch;
  let sent = 0;
  globalThis.fetch = async (url) => {
    assert.ok(String(url).startsWith("https://api.telegram.org/"));
    sent++;
    return Response.json({ ok: true, result: { message_id: 1 } });
  };
  try {
    assert.equal(
      (await post(["appointment-reminder", appointment.id])).status,
      200,
    );
    const repeated = await post(["appointment-reminder", appointment.id]);
    assert.equal(repeated.status, 429);
    assert.equal(sent, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
  activeActor = { ...admin, doctor: null };
  const status = await erp.GET(
    new Request("http://localhost/api/erp/system-status"),
    { params: Promise.resolve({ path: ["system-status"] }) },
  );
  assert.equal(status.status, 200);
  assert.equal((await status.json()).status, "HEALTHY");
  console.log(
    "PASS endpoint permissions for reception/doctor/admin, reminder ownership and throttling with mocked Telegram, and database diagnostics.",
  );
  console.log(
    "PASS isolated migrations, legacy leave defaults, weekly atomic rollback, pending/approved/rejected leave, ownership, date overrides, duplicate protection, eligibility-aware suggestions, secret-free export and doctor-only auto approval.",
  );
  console.log(
    "PGlite is single-connection; native PostgreSQL concurrency and real Telegram delivery remain unverified.",
  );
} finally {
  mock.restore();
  await prisma.$disconnect();
  await pool.end();
  await server.stop();
  await database.close();
  await rm(directory, { recursive: true, force: true });
}
