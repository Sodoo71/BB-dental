import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { chromium } from "@playwright/test";
import { today } from "../lib/domain";
const dir = await mkdtemp(join(tmpdir(), "bb-reception-browser-"));
const database = await PGlite.create();
const server = new PGLiteSocketServer({
  db: database,
  host: "127.0.0.1",
  port: 3198,
  maxConnections: 20,
});
const pool = new Pool({
  host: "127.0.0.1",
  port: 3198,
  user: "postgres",
  database: "reception_test",
  max: 1,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const base = "http://localhost:3197";
let app, browser;
let logs = "";
let checks = 0;
function pass(message) {
  checks++;
  console.log(`PASS ${message}`);
}
try {
  for (const m of (await readdir("prisma/migrations", { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort())
    await database.exec(
      await readFile(`prisma/migrations/${m}/migration.sql`, "utf8"),
    );
  await server.start();
  const tokens = {};
  const users = {};
  for (const [i, role] of ["RECEPTION", "DOCTOR", "ADMIN"].entries()) {
    const user = await prisma.user.create({
      data: { name: role, phone: `9911000${i}`, role, passwordHash: "test" },
    });
    const token = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    tokens[role] = token;
    users[role] = user;
  }
  const doctor = await prisma.doctor.create({
    data: {
      name: "Test Doctor",
      specialty: "General",
      userId: users.DOCTOR.id,
    },
  });
  const service = await prisma.service.create({
    data: { name: "Checkup", category: "General", price: 200000, duration: 30 },
  });
  const patient = await prisma.patient.create({
    data: {
      name: "Test Patient",
      phone: "99112233",
      allergies: "Penicillin",
      medicalHistory: "SECRET_MEDICAL_HISTORY",
    },
  });
  await prisma.patientNote.create({
    data: {
      patientId: patient.id,
      authorId: users.DOCTOR.id,
      content: "SECRET_DOCTOR_NOTE",
    },
  });
  for (let weekday = 0; weekday < 7; weekday++)
    await prisma.schedule.create({
      data: {
        doctorId: doctor.id,
        weekday,
        startTime: "09:00",
        endTime: "18:00",
      },
    });
  const appointment = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      serviceId: service.id,
      date: today(),
      startTime: "09:00",
      endTime: "09:30",
      status: "CONFIRMED",
    },
  });
  const connection = "postgresql://postgres@127.0.0.1:3198/reception_test";
  app = spawn(
    "node",
    ["node_modules/next/dist/bin/next", "start", "-p", "3197"],
    {
      env: {
        ...process.env,
        DATABASE_URL: connection,
        DIRECT_URL: connection,
        APP_URL: base,
        TELEGRAM_BOT_TOKEN: "",
        SMTP_HOST: "",
        NODE_OPTIONS: "",
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  app.stdout.on("data", (b) => {
    logs = (logs + b).slice(-10000);
  });
  app.stderr.on("data", (b) => {
    logs = (logs + b).slice(-10000);
  });
  for (let n = 0; n < 120; n++) {
    try {
      if ((await fetch(base + "/login")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  async function call(path, role = "RECEPTION", method = "GET", payload) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(role ? { Cookie: `bb_session=${tokens[role]}` } : {}),
        Origin: base,
        "Content-Type": "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return { status: response.status, body: await response.json() };
  }
  for (const role of [null, "DOCTOR", "ADMIN"])
    assert.equal(
      (await call("/api/reception/dashboard", role)).status,
      role ? 403 : 401,
    );
  assert.equal(
    (
      await call("/api/reception/cash-open", "DOCTOR", "POST", {
        openingCash: 0,
      })
    ).status,
    403,
  );
  pass("Reception APIs reject anonymous, Doctor and Admin callers");
  const profile = await call(`/api/erp/patients/${patient.id}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.allergies, "Penicillin");
  assert.equal(profile.body.medicalHistory, undefined);
  assert.equal(profile.body.notes, undefined);
  for (const path of ["treatments", "documents", "users", "reports", "doctors"])
    assert.equal((await call(`/api/erp/${path}`)).status, 403);
  assert.equal(
    (
      await call("/api/erp/patient-notes", "RECEPTION", "POST", {
        patientId: patient.id,
        content: "Forbidden",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/erp/payments", "RECEPTION", "POST", {})).status,
    403,
  );
  pass(
    "Reception cannot read or mutate confidential clinical records or bypass POS",
  );
  assert.equal(
    (await call(`/api/export/patient?id=${patient.id}`)).status,
    403,
  );
  assert.equal((await call("/api/export/document?id=any")).status, 403);
  pass(
    "Legacy clinical PDF exports cannot bypass Reception privacy restrictions",
  );
  const edited = await call(
    `/api/erp/patients/${patient.id}`,
    "RECEPTION",
    "PATCH",
    {
      name: "Test Patient",
      phone: patient.phone,
      medicalHistory: "OVERWRITE",
      allergies: "OVERWRITE",
    },
  );
  assert.equal(edited.status, 200);
  const clinical = await prisma.patient.findUniqueOrThrow({
    where: { id: patient.id },
  });
  assert.equal(clinical.medicalHistory, "SECRET_MEDICAL_HISTORY");
  assert.equal(clinical.allergies, "Penicillin");
  pass(
    "Patient demographics editing preserves doctor-maintained alerts and history",
  );
  const future = {
    patientId: patient.id,
    name: patient.name,
    phone: patient.phone,
    doctorId: doctor.id,
    serviceId: service.id,
    date: "2099-01-05",
    startTime: "09:00",
  };
  const created = await call(
    "/api/erp/appointments",
    "RECEPTION",
    "POST",
    future,
  );
  assert.equal(created.status, 201);
  assert.equal(
    (await call("/api/erp/appointments", "RECEPTION", "POST", future)).status,
    409,
  );
  assert.equal(
    (
      await call(
        `/api/erp/reschedule/${created.body.id}`,
        "RECEPTION",
        "POST",
        {
          doctorId: doctor.id,
          serviceId: service.id,
          date: future.date,
          startTime: "10:00",
        },
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await prisma.appointment.findUniqueOrThrow({
        where: { id: created.body.id },
      })
    ).startTime,
    "10:00",
  );
  pass("Appointment API creation, rescheduling and double-booking protection");
  const manualPayload = { ...future, date: "2099-02-03", startTime: "09:10" };
  assert.equal(
    (await call("/api/erp/appointments", "ADMIN", "POST", manualPayload))
      .status,
    201,
  );
  assert.equal(
    (
      await call("/api/erp/appointments", "ADMIN", "POST", {
        ...manualPayload,
        startTime: "09:20",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/api/erp/appointments", "ADMIN", "POST", {
        ...manualPayload,
        startTime: "08:10",
      })
    ).status,
    409,
  );
  pass(
    "Admin phone-booking API accepts manual minutes and rejects overlap/outside working hours",
  );
  const specialPayload = { ...manualPayload, force: true, startTime: "08:10" };
  const special = await call(
    "/api/erp/appointments",
    "ADMIN",
    "POST",
    specialPayload,
  );
  assert.equal(special.status, 201);
  assert.equal(
    (
      await call("/api/erp/appointments", "RECEPTION", "POST", {
        ...specialPayload,
        startTime: "07:10",
      })
    ).status,
    201,
  );
  assert.equal(
    (await call("/api/erp/appointments", "DOCTOR", "POST", specialPayload))
      .status,
    403,
  );
  assert.equal(
    (
      await call("/api/erp/appointments", "ADMIN", "POST", {
        ...specialPayload,
        startTime: "08:20",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/api/erp/appointments", "ADMIN", "POST", {
        ...specialPayload,
        startTime: "23:50",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/api/public/booking", null, "POST", {
        ...specialPayload,
        date: "2099-03-01",
        phone: "99117788",
        name: "Public Forced",
        startTime: "08:10",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        `/api/erp/reschedule/${special.body.id}`,
        "RECEPTION",
        "POST",
        {
          doctorId: doctor.id,
          serviceId: service.id,
          date: manualPayload.date,
          startTime: "19:10",
          force: true,
        },
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await call(`/api/erp/reschedule/${special.body.id}`, "ADMIN", "POST", {
        doctorId: doctor.id,
        serviceId: service.id,
        date: manualPayload.date,
        startTime: "19:10",
        force: true,
      })
    ).status,
    201,
  );
  assert.equal(
    await prisma.auditLog.count({
      where: {
        entityId: special.body.id,
        action: "APPOINTMENT_SCHEDULE_OVERRIDE",
        actorId: users.ADMIN.id,
      },
    }),
    2,
  );
  pass(
    "Special time supports Admin/Reception, is audited, and retains conflict, duration and public-access protections",
  );
  const noRoster = await prisma.doctor.create({
    data: { name: "No roster doctor", specialty: "General" },
  });
  const noRosterPayload = {
    ...specialPayload,
    doctorId: noRoster.id,
    date: "2099-03-01",
    startTime: "12:10",
  };
  assert.equal(
    (
      await call("/api/erp/appointments", "ADMIN", "POST", {
        ...noRosterPayload,
        force: false,
      })
    ).status,
    409,
  );
  assert.equal(
    (await call("/api/erp/appointments", "ADMIN", "POST", noRosterPayload))
      .status,
    201,
  );
  await prisma.doctor.update({
    where: { id: noRoster.id },
    data: { active: false },
  });
  assert.equal(
    (
      await call("/api/erp/appointments", "ADMIN", "POST", {
        ...noRosterPayload,
        startTime: "14:10",
      })
    ).status,
    409,
  );
  await prisma.leave.create({
    data: {
      doctorId: doctor.id,
      date: "2099-03-02",
      kind: "DAY_OFF",
      status: "APPROVED",
      startTime: "00:00",
      endTime: "23:59",
      reason: "Isolated special-time test",
    },
  });
  assert.equal(
    (
      await call("/api/erp/appointments", "ADMIN", "POST", {
        ...manualPayload,
        date: "2099-03-02",
        startTime: "12:10",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/api/erp/appointments", "ADMIN", "POST", {
        ...specialPayload,
        date: "2099-03-02",
        startTime: "12:10",
      })
    ).status,
    201,
  );
  pass(
    "Admin special time supports missing roster and approved day off while still rejecting inactive doctors",
  );
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    { name: "bb_session", value: tokens.RECEPTION, url: base },
  ]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/erp");
  await page
    .getByRole("heading", { name: "Хяналтын самбар", exact: true })
    .waitFor();
  await page.getByText("Test Patient", { exact: true }).waitFor();
  const nav = page.locator("#erp-navigation");
  assert.equal(await nav.locator("a").count(), 10);
  for (const [route, title] of [
    ["patients", "Өвчтөнүүд"],
    ["appointments", "Цаг захиалга"],
    ["visits", "Өнөөдрийн үзлэг"],
    ["queue", "Дараалал"],
    ["payments", "Касс / POS"],
    ["transactions", "Гүйлгээ"],
    ["receivables", "Авлага"],
    ["notifications", "Мэдэгдэл"],
    ["reports", "Тайлан"],
  ]) {
    await nav.getByRole("link", { name: title, exact: true }).click();
    await page
      .getByRole("heading", { name: title, exact: true, level: 1 })
      .waitFor();
    await page.waitForLoadState("networkidle");
    assert.equal(
      await page
        .getByText("Энэ хэсэгт хандах эрхгүй байна.", { exact: true })
        .count(),
      0,
    );
    assert.equal(
      await nav.locator('[aria-current="page"]').getAttribute("href"),
      "/erp/" + route,
    );
  }
  pass(
    "All ten Reception screens and active navigation render using real database data",
  );
  await page.goto(base + "/erp/appointments");
  await page.getByRole("button", { name: "Цаг захиалах", exact: true }).click();
  const bookingDialog = page.getByRole("dialog");
  await bookingDialog.getByLabel("Боломжит цагийн өдөр").fill("2099-02-04");
  await bookingDialog
    .getByLabel("Эхлэх цаг", { exact: true })
    .selectOption("09:15");
  assert.equal(
    await bookingDialog.getByLabel("Эхлэх цаг", { exact: true }).inputValue(),
    "09:15",
  );
  await bookingDialog.getByLabel("Боломжит цагийн өдөр").fill("2099-02-05");
  assert.equal(
    await bookingDialog.getByLabel("Эхлэх цаг", { exact: true }).inputValue(),
    "",
  );
  await bookingDialog
    .getByLabel("Эхлэх цаг", { exact: true })
    .selectOption("09:30");
  await bookingDialog
    .getByLabel("Шинэ өвчтөний нэр")
    .fill("Selected Time Patient");
  await bookingDialog.getByLabel("Шинэ өвчтөний утас").fill("99112255");
  await bookingDialog
    .getByRole("button", { name: "Цаг баталгаажуулах", exact: true })
    .click();
  try {
    await bookingDialog.waitFor({ state: "hidden", timeout: 8000 });
  } catch (e) {
    console.error("BOOKING FORM", await bookingDialog.innerText());
    throw e;
  }
  const selectedBooking = await prisma.appointment.findFirstOrThrow({
    where: { patient: { phone: "99112255" } },
  });
  assert.equal(selectedBooking.startTime, "09:30");
  pass(
    "Appointment time select persists selection and clears stale time after changing date",
  );
  await page.getByRole("button", { name: "Цаг захиалах", exact: true }).click();
  await bookingDialog.getByLabel("Боломжит цагийн өдөр").fill("2099-02-06");
  await bookingDialog
    .getByLabel("Утсаар авсан захиалга", { exact: false })
    .check();
  await bookingDialog.getByLabel("Эхлэх цаг", { exact: true }).fill("08:10");
  await bookingDialog
    .getByLabel("Шинэ өвчтөний нэр")
    .fill("Reception Special Patient");
  await bookingDialog.getByLabel("Шинэ өвчтөний утас").fill("99112277");
  await bookingDialog
    .getByRole("button", { name: "Цаг баталгаажуулах", exact: true })
    .click();
  await bookingDialog.waitFor({ state: "hidden" });
  const receptionSpecial = await prisma.appointment.findFirstOrThrow({
    where: { patient: { phone: "99112277" } },
  });
  assert.equal(receptionSpecial.startTime, "08:10");
  assert.equal(receptionSpecial.createdById, users.RECEPTION.id);
  assert.equal(
    await prisma.auditLog.count({
      where: {
        entityId: receptionSpecial.id,
        actorId: users.RECEPTION.id,
        action: "APPOINTMENT_SCHEDULE_OVERRIDE",
      },
    }),
    1,
  );
  pass(
    "Reception checkbox creates an audited special booking outside normal hours",
  );
  await page.goto(base + "/erp/patients");
  await page
    .getByRole("button", { name: "Өвчтөн бүртгэх", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Овог нэр/).fill("Browser Registered");
  await dialog.getByLabel(/^Утас/).fill("99112244");
  const genderSelect = dialog.getByRole("combobox", { name: /^Хүйс/ });
  await genderSelect.evaluate((el) => {
    el.value = "FEMALE";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  await genderSelect.evaluate((el) =>
    el.dispatchEvent(new Event("change", { bubbles: true })),
  );
  assert.equal(await genderSelect.inputValue(), "FEMALE");
  await dialog.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await page
    .getByRole("button", { name: "Browser Registered", exact: true })
    .waitFor();
  const registeredPatient = await prisma.patient.findUniqueOrThrow({
    where: { phone: "99112244" },
  });
  assert.equal(registeredPatient.gender, "FEMALE");
  pass("Patient registration UI persists to database");
  const registeredRow = page.getByRole("row").filter({ hasText: "99112244" });
  await registeredRow
    .getByRole("button", { name: "Засах", exact: true })
    .click();
  const editGender = dialog.getByRole("combobox", { name: /^Хүйс/ });
  assert.equal(await editGender.inputValue(), "FEMALE");
  await editGender.evaluate((el) => {
    el.value = "MALE";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  await editGender.evaluate((el) =>
    el.dispatchEvent(new Event("change", { bubbles: true })),
  );
  assert.equal(await editGender.inputValue(), "MALE");
  await dialog.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    (
      await prisma.patient.findUniqueOrThrow({
        where: { id: registeredPatient.id },
      })
    ).gender,
    "MALE",
  );
  await registeredRow
    .getByRole("button", { name: "Засах", exact: true })
    .click();
  assert.equal(
    await dialog.getByRole("combobox", { name: /^Хүйс/ }).inputValue(),
    "MALE",
  );
  await dialog.getByRole("button", { name: "Хаах", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  pass(
    "Patient dropdown editing persists to database and restores after reopening",
  );

  await page.goto(base + "/erp/visits");
  await page.getByText("Test Patient", { exact: true }).waitFor();
  await page.locator(".reception-menu summary").click();
  await page.getByRole("button", { name: "Мэдээлэл шалгах / Ирсэн" }).click();
  await dialog.getByRole("combobox").selectOption("YES");
  await dialog.getByRole("button", { name: "Ирсэн / Дараалалд нэмэх" }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.ok(
    await prisma.queueEntry.findUnique({
      where: { appointmentId: appointment.id },
    }),
  );
  await page.goto(base + "/erp/queue");
  await page.getByText("#1", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Дуудсан", exact: true }).click();
  await page.getByRole("button", { name: "Эмчилж буй", exact: true }).waitFor();
  pass(
    "Browser check-in and queue transition persist arrival and called state",
  );
  await page.goto(base + "/erp/payments");
  await page
    .getByRole("button", { name: "Кассын ээлж нээх", exact: true })
    .click();
  await dialog.getByLabel("Эхлэх бэлэн үлдэгдэл").fill("10000");
  await dialog.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  const inv = await call("/api/reception/invoice-create", "RECEPTION", "POST", {
    patientId: patient.id,
    appointmentId: appointment.id,
    dueDate: today(),
    items: [{ serviceId: service.id, quantity: 1 }],
  });
  assert.equal(inv.status, 200);
  assert.equal(
    (
      await call("/api/reception/invoice-finalize", "RECEPTION", "POST", {
        id: inv.body.id,
      })
    ).status,
    200,
  );
  await page.getByRole("button", { name: "Мэдээлэл шинэчлэх" }).click();
  await page.getByRole("button", { name: "Нээх / Төлөх" }).click();
  await dialog
    .getByRole("button", { name: "Төлбөр / Хэсэгчилсэн төлөлт" })
    .click();
  await dialog.getByLabel("Энэ удаа төлөх дүн").fill("50000");
  await dialog.getByLabel("Дүн", { exact: true }).fill("50000");
  await dialog.getByLabel("Мөнгө хүлээн авсан, гүйлгээг шалгасан").check();
  await dialog
    .getByRole("button", { name: "Төлбөр бүртгэх", exact: true })
    .click();
  await dialog.getByText(/Төлсөн: 50,000/).waitFor();
  assert.equal(
    await prisma.payment.count({ where: { invoiceId: inv.body.id } }),
    1,
  );
  pass(
    "Browser cash-session opening and partial payment produce a real receipt",
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/erp");
  await page
    .getByRole("heading", { name: "Хяналтын самбар", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Цэс нээх", exact: true }).click();
  await page
    .locator("#erp-navigation")
    .getByRole("link", { name: "Дараалал", exact: true })
    .click();
  await page.getByRole("heading", { name: "Дараалал", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await mkdir("/private/tmp/bb-reception-qa", { recursive: true });
  await page.screenshot({
    path: "/private/tmp/bb-reception-qa/mobile-queue-dark.png",
    fullPage: true,
  });
  pass("Mobile navigation, dark theme and horizontal overflow checks");
  for (const role of ["DOCTOR", "ADMIN"]) {
    await context.clearCookies();
    await context.addCookies([
      { name: "bb_session", value: tokens[role], url: base },
    ]);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/erp");
    await page.locator(".role-home").waitFor();
    assert.equal(
      await page
        .locator("#erp-navigation")
        .getByRole("link", { name: "Дараалал", exact: true })
        .count(),
      0,
    );
  }
  pass(
    "Doctor and Admin still render their original dashboards and navigation",
  );
  await page.goto(base + "/erp/appointments");
  await page.getByRole("button", { name: "Цаг товлох", exact: true }).click();
  const adminBooking = page.getByRole("dialog");
  await adminBooking.getByLabel("Боломжит цагийн өдөр").fill("2099-02-06");
  await adminBooking
    .getByLabel("Утсаар авсан захиалга", { exact: false })
    .check();
  await adminBooking.getByLabel("Эхлэх цаг", { exact: true }).fill("19:10");
  await adminBooking
    .getByLabel("Шинэ өвчтөний нэр")
    .fill("Manual Phone Patient");
  await adminBooking.getByLabel("Шинэ өвчтөний утас").fill("99112266");
  await adminBooking
    .getByRole("button", { name: "Цаг баталгаажуулах", exact: true })
    .click();
  await adminBooking.waitFor({ state: "hidden" });
  const manualBooking = await prisma.appointment.findFirstOrThrow({
    where: { patient: { phone: "99112266" } },
  });
  assert.equal(manualBooking.startTime, "19:10");
  assert.equal(manualBooking.createdById, users.ADMIN.id);
  pass(
    "Admin phone-booking checkbox saves a special appointment outside regular hours",
  );
  assert.deepEqual(errors, []);
  console.log(`${checks} browser/API verification groups passed.`);
} catch (e) {
  console.error(logs);
  throw e;
} finally {
  if (browser) await browser.close();
  if (app) {
    app.kill("SIGTERM");
    await new Promise((r) => app.once("exit", r));
  }
  await prisma.$disconnect();
  await pool.end();
  await server.stop();
  await database.close();
  await rm(dir, { recursive: true, force: true });
}
