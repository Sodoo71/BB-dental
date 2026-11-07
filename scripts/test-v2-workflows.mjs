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
  const { saveLeave, saveWeek, reviewLeave, removeLeave, weekSchema } =
    await import("../lib/schedule-actions");
  const { availability } = await import("../lib/booking");
  const { earliestAvailability, calendarAvailability } =
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
  const beforeApproval = await calendarAvailability(
    service.id,
    doctor.id,
    overrideDate,
    1,
  );
  assert.deepEqual(
    beforeApproval,
    [],
    "pending working day is disabled on the public calendar",
  );
  await reviewLeave(override.id, "APPROVED", admin.id);
  const afterApproval = await calendarAvailability(
    service.id,
    doctor.id,
    overrideDate,
    1,
  );
  assert.equal(afterApproval[0].date, overrideDate);
  assert.equal(afterApproval[0].doctorId, doctor.id);
  assert.equal(afterApproval[0].startTime, "14:00");
  assert.deepEqual(
    await calendarAvailability(service.id, other.id, overrideDate, 1),
    [],
    "selected doctor's calendar excludes other doctors",
  );
  await assert.rejects(
    calendarAvailability(service.id, doctor.id, overrideDate, 32),
    (e) => e.status === 400,
  );
  const conflictRequest = await saveLeave(
    {
      doctorId: doctor.id,
      date,
      kind: "SCHEDULE_OVERRIDE",
      startTime: "14:00",
      endTime: "16:00",
      reason: "Conflicts with existing booking",
    },
    actor,
  );
  assert.equal(
    conflictRequest.status,
    "PENDING",
    "doctor can submit a request for admin review",
  );
  await assert.rejects(
    reviewLeave(conflictRequest.id, "APPROVED", admin.id),
    (e) => e.status === 409,
  );
  await reviewLeave(conflictRequest.id, "REJECTED", admin.id);
  const adminDay = await saveLeave(
    {
      doctorId: other.id,
      date: overrideDate,
      kind: "SCHEDULE_OVERRIDE",
      startTime: "16:00",
      endTime: "17:00",
      reason: "Admin entered work day",
    },
    { id: admin.id, role: "ADMIN" },
  );
  assert.equal(adminDay.status, "APPROVED");
  const generalService = await prisma.service.create({
    data: {
      name: "General visit",
      category: "General",
      price: 45000,
      duration: 30,
    },
  });
  assert.equal(
    (
      await calendarAvailability(generalService.id, other.id, overrideDate, 1)
    )[0].startTime,
    "16:00",
  );
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
  assert.equal(exported.leaves.length, 6);
  // A proposed edit/cancellation must leave official hours bookable until review.
  const changeDate = "2099-02-01";
  const originalHours = await saveLeave(
    {
      doctorId: doctor.id,
      date: changeDate,
      kind: "SCHEDULE_OVERRIDE",
      startTime: "09:00",
      endTime: "18:00",
      reason: "Official working day",
    },
    { id: admin.id, role: "ADMIN" },
  );
  const editRequest = await saveLeave(
    {
      doctorId: doctor.id,
      date: changeDate,
      kind: "SCHEDULE_OVERRIDE",
      startTime: "14:00",
      endTime: "16:00",
      reason: "Proposed edit",
    },
    actor,
    originalHours.id,
  );
  assert.equal(editRequest.status, "PENDING");
  assert.equal(editRequest.replacesId, originalHours.id);
  assert.ok(
    (await availability(doctor.id, service.id, changeDate, prisma)).includes(
      "09:00",
    ),
  );
  await reviewLeave(editRequest.id, "REJECTED", admin.id);
  assert.equal(
    (await prisma.leave.findUniqueOrThrow({ where: { id: originalHours.id } }))
      .status,
    "APPROVED",
  );
  const acceptedEdit = await saveLeave(
    {
      doctorId: doctor.id,
      date: changeDate,
      kind: "SCHEDULE_OVERRIDE",
      startTime: "14:00",
      endTime: "16:00",
      reason: "Accepted edit",
    },
    actor,
    originalHours.id,
  );
  await reviewLeave(acceptedEdit.id, "APPROVED", admin.id);
  assert.equal(
    await prisma.leave.findUnique({ where: { id: originalHours.id } }),
    null,
  );
  assert.equal(
    (await availability(doctor.id, service.id, changeDate, prisma))[0],
    "14:00",
  );
  const cancellation = await removeLeave(acceptedEdit.id, actor);
  assert.equal(cancellation.status, "PENDING");
  assert.ok(
    (await availability(doctor.id, service.id, changeDate, prisma)).includes(
      "14:00",
    ),
  );
  const bookedChange = await prisma.appointment.create({
    data: {
      doctorId: doctor.id,
      patientId: patient.id,
      serviceId: service.id,
      date: changeDate,
      startTime: "14:00",
      endTime: "14:30",
      status: "CONFIRMED",
    },
  });
  await assert.rejects(
    reviewLeave(cancellation.id, "APPROVED", admin.id),
    (e) => e.status === 409,
  );
  assert.equal(
    (await prisma.leave.findUniqueOrThrow({ where: { id: acceptedEdit.id } }))
      .status,
    "APPROVED",
    "failed cancellation restores original official record atomically",
  );
  assert.equal(
    (await prisma.leave.findUniqueOrThrow({ where: { id: cancellation.id } }))
      .status,
    "PENDING",
  );
  await prisma.appointment.delete({ where: { id: bookedChange.id } });
  await reviewLeave(cancellation.id, "APPROVED", admin.id);
  assert.deepEqual(
    await availability(doctor.id, service.id, changeDate, prisma),
    [],
  );
  const { today } = await import("../lib/domain");
  const shiftDay = (offset) =>
    new Date(Date.parse(`${today()}T12:00:00Z`) + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  const protectedDay = await saveLeave(
    {
      doctorId: doctor.id,
      date: shiftDay(7),
      kind: "SCHEDULE_OVERRIDE",
      startTime: "09:00",
      endTime: "18:00",
      reason: "Boundary protected day",
    },
    { id: admin.id, role: "ADMIN" },
  );
  await assert.rejects(
    removeLeave(protectedDay.id, actor),
    (e) => e.status === 403,
  );
  await assert.rejects(
    saveLeave(
      {
        doctorId: doctor.id,
        date: shiftDay(7),
        kind: "SCHEDULE_OVERRIDE",
        startTime: "10:00",
        endTime: "17:00",
        reason: "Cannot bypass by POST",
      },
      actor,
    ),
    (e) => e.status === 403,
  );
  await assert.rejects(
    saveLeave(
      {
        doctorId: doctor.id,
        date: shiftDay(7),
        kind: "BLOCKED_RANGE",
        startTime: "10:00",
        endTime: "17:00",
        reason: "Cannot bypass by blocking",
      },
      actor,
    ),
    (e) => e.status === 403,
  );
  const editableDay = await saveLeave(
    {
      doctorId: doctor.id,
      date: shiftDay(8),
      kind: "SCHEDULE_OVERRIDE",
      startTime: "09:00",
      endTime: "18:00",
      reason: "Outside default protection",
    },
    { id: admin.id, role: "ADMIN" },
  );
  const outsideRequest = await saveLeave(
    {
      doctorId: doctor.id,
      date: shiftDay(8),
      kind: "SCHEDULE_OVERRIDE",
      startTime: "10:00",
      endTime: "17:00",
      reason: "Outside protection",
    },
    actor,
    editableDay.id,
  );
  assert.equal(outsideRequest.status, "PENDING");
  await prisma.setting.upsert({
    where: { key: "scheduleLockDays" },
    create: { key: "scheduleLockDays", value: "14" },
    update: { value: "14" },
  });
  await assert.rejects(
    removeLeave(outsideRequest.id, actor),
    (e) => e.status === 403,
  );
  await prisma.setting.delete({ where: { key: "scheduleLockDays" } });
  await removeLeave(outsideRequest.id, actor);

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
  await prisma.leave.create({
    data: {
      doctorId: other.id,
      date: overrideDate,
      kind: "BLOCKED_RANGE",
      status: "PENDING",
      startTime: "12:00",
      endTime: "13:00",
      reason: "PRIVATE_OTHER_REQUEST",
    },
  });
  await prisma.appointment.create({
    data: {
      doctorId: other.id,
      patientId: patient.id,
      serviceId: generalService.id,
      date: overrideDate,
      startTime: "16:00",
      endTime: "16:30",
    },
  });
  const rosterResponse = await erp.GET(
    new Request(
      `http://localhost/api/erp/roster?from=${overrideDate}&to=${overrideDate}`,
    ),
    { params: Promise.resolve({ path: ["roster"] }) },
  );
  const roster = await rosterResponse.json();
  assert.equal(rosterResponse.status, 200);
  const colleague = roster.doctors.find((d) => d.id === other.id);
  assert.ok(colleague, "doctors can see coworkers on the calendar");
  assert.equal(
    colleague.appointments.length,
    0,
    "coworker bookings are private",
  );
  assert.ok(
    colleague.leaves.every((l) => l.status === "APPROVED" && l.reason === ""),
  );
  assert.ok(!JSON.stringify(roster).includes("PRIVATE_OTHER_REQUEST"));
  assert.equal(roster.policy.lockDays, 7);

  assert.equal(
    (await post(["schedule-week"], { doctorId: doctor.id, days })).status,
    403,
    "doctor cannot publish recurring hours without approval",
  );
  assert.equal(
    (
      await post(["schedules"], {
        doctorId: doctor.id,
        weekday: 1,
        startTime: "09:00",
        endTime: "18:00",
      })
    ).status,
    403,
  );
  assert.equal(
    (await post(["leave-review", conflictRequest.id], { status: "APPROVED" }))
      .status,
    403,
  );
  const weeklyRecord = await prisma.schedule.findFirstOrThrow({
    where: { doctorId: doctor.id },
  });
  for (const method of ["PATCH", "DELETE"]) {
    const response = await erp[method](
      new Request(`http://localhost/api/erp/schedules/${weeklyRecord.id}`, {
        method,
        headers: {
          Origin: "http://localhost",
          "Content-Type": "application/json",
        },
        ...(method === "PATCH"
          ? {
              body: JSON.stringify({
                doctorId: doctor.id,
                weekday: weeklyRecord.weekday,
                startTime: "09:00",
                endTime: "18:00",
              }),
            }
          : {}),
      }),
      { params: Promise.resolve({ path: ["schedules", weeklyRecord.id] }) },
    );
    assert.equal(
      response.status,
      403,
      `doctor cannot ${method} official weekly schedule`,
    );
  }

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
  // Public demographics and guardian fields never expose the clinical record.
  const cookieValues = new Map();
  mock.module("next/headers", () => ({
    cookies: async () => ({
      get: (key) =>
        cookieValues.has(key) ? { value: cookieValues.get(key) } : undefined,
      set: (key, value) => cookieValues.set(key, value),
    }),
  }));
  const publicApi = await import("../app/api/public/[action]/route");
  const publicPost = (action, data) =>
    publicApi.POST(
      new Request(`http://localhost/api/public/${action}`, {
        method: "POST",
        headers: {
          Origin: "http://localhost",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }),
      { params: Promise.resolve({ action }) },
    );
  await prisma.patient.update({
    where: { id: patient.id },
    data: {
      allergies: "PRIVATE_ALLERGY",
      medicalHistory: "PRIVATE_CLINICAL_HISTORY",
      birthDate: "1990-01-01",
      gender: "MALE",
    },
  });
  const returning = await publicPost("returning-contact", {
    phone: patient.phone,
    previouslyVisited: true,
  });
  assert.equal(returning.status, 200);
  const returningData = await returning.json();
  assert.equal(returningData.contact.name, patient.name);
  assert.deepEqual(Object.keys(returningData.contact).sort(), [
    "birthDate",
    "gender",
    "guardianName",
    "guardianPhone",
    "name",
  ]);
  assert.ok(!JSON.stringify(returningData).includes("PRIVATE_"));
  assert.deepEqual(
    await (
      await publicPost("returning-contact", {
        phone: "99119999",
        previouslyVisited: true,
      })
    ).json(),
    { contact: null },
  );
  assert.equal(
    (await publicPost("lookup", { phone: patient.phone, confirmed: true }))
      .status,
    403,
    "a phone number alone cannot reveal appointment history",
  );
  const publicDay = "2099-04-02";
  await saveLeave(
    {
      doctorId: other.id,
      date: publicDay,
      kind: "SCHEDULE_OVERRIDE",
      startTime: "09:00",
      endTime: "12:00",
      reason: "Public booking fixture",
    },
    { id: admin.id, role: "ADMIN" },
  );
  const childBirth = `${Number(today().slice(0, 4)) - 10}-01-01`;
  const childBooking = {
    name: "Хүүхэд Тест",
    phone: "99110009",
    birthDate: childBirth,
    gender: "FEMALE",
    guardianName: "Асран хамгаалагч Тест",
    guardianPhone: "88110009",
    doctorId: other.id,
    serviceId: generalService.id,
    date: publicDay,
    startTime: "09:00",
    note: "PRIVATE_SYMPTOM",
  };
  const missingGuardian = await publicPost("booking", {
    ...childBooking,
    guardianName: "",
    guardianPhone: "",
  });
  assert.equal(missingGuardian.status, 400);
  const childBooked = await publicPost("booking", childBooking);
  assert.equal(childBooked.status, 201, await childBooked.clone().text());
  const bookingResult = await childBooked.json();
  const savedBooking = await prisma.appointment.findUniqueOrThrow({
    where: { id: bookingResult.id },
    include: { patient: true },
  });
  assert.equal(savedBooking.birthDate, childBirth);
  assert.equal(savedBooking.guardianPhone, "88110009");
  assert.equal(savedBooking.patient.guardianName, "Асран хамгаалагч Тест");
  assert.equal(savedBooking.note, "PRIVATE_SYMPTOM");
  assert.ok(cookieValues.has("bb_booking_contact"));
  await prisma.appointment.create({
    data: {
      patientId: savedBooking.patientId,
      doctorId: other.id,
      serviceId: generalService.id,
      date: "2098-01-01",
      startTime: "09:00",
      endTime: "09:30",
    },
  });
  const ownLookup = await publicPost("lookup", {
    phone: childBooking.phone,
    confirmed: true,
  });
  assert.equal(ownLookup.status, 200);
  const ownHistory = await ownLookup.json();
  assert.deepEqual(
    ownHistory.appointments.map((a) => a.id),
    [bookingResult.id],
    "receipt session cannot reveal older clinical appointments",
  );
  assert.ok(!JSON.stringify(ownHistory).includes("PRIVATE_"));
  assert.equal(
    (await publicPost("lookup", { phone: patient.phone, confirmed: true }))
      .status,
    403,
    "receipt session is bound to its phone number",
  );
  const mismatch = await publicPost("booking", {
    ...childBooking,
    name: "Өөр хүн",
    startTime: "10:00",
  });
  assert.equal(
    mismatch.status,
    409,
    "shared numbers cannot silently attach a different person to a clinical record",
  );
  const beforeSessions = await prisma.bookingContactSession.count();
  const collision = await publicPost("booking", {
    ...childBooking,
    startTime: "09:00",
  });
  assert.equal(collision.status, 409);
  assert.equal(
    await prisma.bookingContactSession.count(),
    beforeSessions,
    "failed booking cannot create an orphan contact session",
  );
  await prisma.bookingContactSession.updateMany({
    data: { expiresAt: new Date(0) },
  });
  assert.equal(
    (await publicPost("lookup", { phone: childBooking.phone, confirmed: true }))
      .status,
    403,
    "expired receipts cannot read appointment history",
  );
  console.log(
    "PASS returning contact fields, unknown-number fallback, minor guardian validation/storage, private symptoms, receipt-bound history, identity mismatch and session rollback/expiry.",
  );
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
