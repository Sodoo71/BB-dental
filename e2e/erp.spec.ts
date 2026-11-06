import { readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
} from "@playwright/test";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { today } from "../lib/domain";
test.describe.configure({ mode: "serial" });
const database = process.env.ERP_TEST_DATABASE_URL!;
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: database }),
});
const password = "ERP-qa-password-2026";
let cloudServer: Server, asset: Buffer;
let telegramMock: Server;
let webhookState = { url: "", secret: "" };
const telegramCalls: { method: string; data: Record<string, unknown> }[] = [];
let uploaded = 0,
  delivered = 0,
  failCloud = false;
const origin = "http://localhost:3100";
let admin: APIRequestContext,
  doctor: APIRequestContext,
  other: APIRequestContext,
  reception: APIRequestContext;
let doctorId: string,
  otherDoctorId: string,
  serviceId: string,
  patientId: string,
  appointmentId: string;
const day = new Date(Date.parse(today()) + 2 * 86400000)
  .toISOString()
  .slice(0, 10);
const phoneBase = String(Date.now()).slice(-5);
const phones = {
  admin: `99${phoneBase}1`,
  doctor: `99${phoneBase}2`,
  other: `99${phoneBase}3`,
  reception: `99${phoneBase}4`,
  patient: `99${phoneBase}5`,
  public: `99${phoneBase}6`,
};
const post = (ctx: APIRequestContext, url: string, data: unknown) =>
  ctx.post(url, { data, headers: { Origin: origin } });
const patch = (ctx: APIRequestContext, url: string, data: unknown) =>
  ctx.patch(url, { data, headers: { Origin: origin } });
async function login(phone: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: origin });
  const response = await post(ctx, "/api/auth/login", { phone, password });
  expect(response.status(), await response.text()).toBe(200);
  return ctx;
}
test.beforeAll(async () => {
  asset = await readFile("public/images/default-logo.png");
  telegramMock = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const method = req.url?.split("/").pop() || "";
      const data = JSON.parse(raw || "{}");
      telegramCalls.push({ method, data });
      let result: unknown = true;
      if (method === "getMe")
        result = { username: "BBQaBot", first_name: "BB Dental QA" };
      if (method === "setWebhook")
        webhookState = {
          url: String(data.url),
          secret: String(data.secret_token),
        };
      if (method === "deleteWebhook") webhookState = { url: "", secret: "" };
      if (method === "getWebhookInfo")
        result = { url: webhookState.url, pending_update_count: 0 };
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, result }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    telegramMock.once("error", reject);
    telegramMock.listen(35360, "127.0.0.1", resolve);
  });

  cloudServer = createServer(async (req, res) => {
    if (req.url === "/asset") {
      delivered++;
      res.setHeader("Content-Type", "image/png");
      res.end(asset);
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": String(req.headers["content-type"]) },
    }).formData();
    const params = ["folder", "format", "timestamp", "transformation"]
      .map((key) => `${key}=${form.get(key)}`)
      .join("&");
    if (
      form.get("signature") !==
        createHash("sha1")
          .update(params + "qa-cloud-secret")
          .digest("hex") ||
      failCloud
    ) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: { message: "QA rejected" } }));
      return;
    }
    uploaded++;
    const id = `${form.get("folder")}/qa-${uploaded}`;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        secure_url: `https://res.cloudinary.com/qa-cloud/image/upload/v1/${id}.${form.get("format")}`,
        public_id: id,
        width: 512,
        height: 512,
      }),
    );
  });
  await new Promise<void>((resolve, reject) => {
    cloudServer.once("error", reject);
    cloudServer.listen(35361, "127.0.0.1", resolve);
  });

  const passwordHash = await hash(password, 12);
  for (const [name, role] of [
    ["admin", "ADMIN"],
    ["doctor", "DOCTOR"],
    ["other", "DOCTOR"],
    ["reception", "RECEPTION"],
  ] as const) {
    const u = await db.user.create({
      data: { name: `QA ${name}`, phone: phones[name], role, passwordHash },
    });
    if (role === "DOCTOR") {
      const d = await db.doctor.create({
        data: {
          userId: u.id,
          name: `QA ${name}`,
          specialty: "Шүдний эмч",
          schedules: {
            create: Array.from({ length: 7 }, (_, weekday) => ({
              weekday,
              startTime: "09:00",
              endTime: "19:00",
            })),
          },
        },
      });
      if (name === "doctor") doctorId = d.id;
      else otherDoctorId = d.id;
    }
  }
  admin = await login(phones.admin);
  doctor = await login(phones.doctor);
  other = await login(phones.other);
  reception = await login(phones.reception);
});
test.beforeEach(async ({ page }) => {
  await page.route("https://res.cloudinary.com/qa-cloud/**", (route) =>
    route.fulfill({ contentType: "image/png", body: asset }),
  );
  await page.route("**/_next/image?*", (route) =>
    new URL(route.request().url()).searchParams
      .get("url")
      ?.startsWith("https://res.cloudinary.com/qa-cloud/")
      ? route.fulfill({ contentType: "image/png", body: asset })
      : route.continue(),
  );
});
test.afterAll(async () => {
  for (const ctx of [admin, doctor, other, reception]) await ctx?.dispose();
  if (telegramMock)
    await new Promise<void>((resolve) => telegramMock.close(() => resolve()));
  if (cloudServer)
    await new Promise<void>((resolve) => cloudServer.close(() => resolve()));
  await db.$disconnect();
});
test("server role enforcement, staff creation and catalog", async () => {
  expect((await doctor.get("/api/erp/users")).status()).toBe(403);
  expect((await reception.get("/api/erp/reports")).status()).toBe(403);
  expect(
    (await post(reception, "/api/erp/services", { name: "Bad" })).status(),
  ).toBe(403);
  const create = await post(admin, "/api/erp/services", {
    name: `QA Үзлэг ${phoneBase}`,
    category: "Ерөнхий үзлэг",
    price: 25000,
    duration: 30,
  });
  expect(create.status(), await create.text()).toBe(201);
  serviceId = (await create.json()).id;
  const catalog = await (await admin.get("/api/public/catalog")).json();
  expect(catalog.services.some((s: { id: string }) => s.id === serviceId)).toBe(
    true,
  );
  const users = await (await admin.get("/api/erp/users")).json();
  expect(JSON.stringify(users)).not.toContain("passwordHash");
  const anonymous = await playwrightRequest.newContext({ baseURL: origin });
  expect((await anonymous.get("/api/erp/patients")).status()).toBe(401);
  await anonymous.dispose();
});
test("manual booking, concurrent overlap rejection and own-patient access", async () => {
  const p = await post(reception, "/api/erp/patients", {
    name: "QA Өвчтөн",
    phone: phones.patient,
    allergies: "Пенициллин",
  });
  expect(p.status(), await p.text()).toBe(201);
  patientId = (await p.json()).id;
  const data = {
    patientId,
    name: "QA Өвчтөн",
    phone: phones.patient,
    doctorId,
    serviceId,
    date: day,
    startTime: "09:00",
  };
  const results = await Promise.all([
    post(reception, "/api/erp/appointments", data),
    post(reception, "/api/erp/appointments", data),
  ]);
  expect(results.map((r) => r.status()).sort()).toEqual([201, 409]);
  appointmentId = (await results.find((r) => r.status() === 201)!.json()).id;
  expect((await doctor.get(`/api/erp/patients/${patientId}`)).status()).toBe(
    200,
  );
  expect((await other.get(`/api/erp/patients/${patientId}`)).status()).toBe(
    404,
  );
  const theirs = await (
    await other.get("/api/erp/appointments?period=all")
  ).json();
  expect(theirs.items.some((i: { id: string }) => i.id === appointmentId)).toBe(
    false,
  );
  expect(
    (await other.get(`/api/export/patient?id=${patientId}`)).status(),
  ).toBe(404);
  const busyLeave = await post(doctor, "/api/erp/leaves", {
    doctorId,
    date: day,
    startTime: "09:00",
    endTime: "10:00",
    reason: "Чөлөө",
  });
  expect(busyLeave.status()).toBe(409);
  expect(
    (
      await post(doctor, "/api/erp/schedules", {
        doctorId: otherDoctorId,
        weekday: 1,
        startTime: "09:00",
        endTime: "18:00",
      })
    ).status(),
  ).toBe(403);
  const shifted = await post(
    reception,
    `/api/erp/reschedule/${appointmentId}`,
    { doctorId, serviceId, date: day, startTime: "11:00" },
  );
  expect(shifted.status(), await shifted.text()).toBe(201);
  expect(
    (await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } }))
      .startTime,
  ).toBe("11:00");
  const schedule = await db.schedule.findUniqueOrThrow({
    where: {
      doctorId_weekday: {
        doctorId,
        weekday: new Date(`${day}T12:00Z`).getUTCDay(),
      },
    },
  });
  const badHours = await patch(admin, `/api/erp/schedules/${schedule.id}`, {
    doctorId,
    weekday: schedule.weekday,
    startTime: "09:00",
    endTime: "10:00",
  });
  expect(badHours.status()).toBe(409);
  const goodHours = await patch(doctor, `/api/erp/schedules/${schedule.id}`, {
    doctorId,
    weekday: schedule.weekday,
    startTime: "09:00",
    endTime: "18:00",
  });
  expect(goodHours.status(), await goodHours.text()).toBe(200);
  const res = await patch(doctor, `/api/erp/appointments/${appointmentId}`, {
    status: "COMPLETED",
  });
  expect(res.status(), await res.text()).toBe(200);
});
test("treatment, repeat appointment, cashier idempotency and financial totals", async () => {
  const t = await post(doctor, "/api/erp/treatments", {
    patientId,
    doctorId,
    serviceId,
    appointmentId,
    date: day,
    tooth: 16,
    diagnosis: "QA үзлэг",
    procedure: "Үзлэг хийв",
    amount: 25000,
  });
  expect(t.status(), await t.text()).toBe(201);
  const repeat = await post(reception, "/api/erp/appointments", {
    patientId,
    name: "QA Өвчтөн",
    phone: phones.patient,
    doctorId,
    serviceId,
    date: day,
    startTime: "10:00",
    repeatOfId: appointmentId,
  });
  expect(repeat.status(), await repeat.text()).toBe(201);
  const key = randomUUID();
  const p = {
    patientId,
    appointmentId,
    date: day,
    amount: 25000,
    method: "CASH",
    idempotencyKey: key,
  };
  expect((await post(reception, "/api/erp/payments", p)).status()).toBe(201);
  expect((await post(reception, "/api/erp/payments", p)).status()).toBe(409);
  expect(
    (
      await post(reception, "/api/erp/payments", {
        ...p,
        amount: -5,
        idempotencyKey: randomUUID(),
      })
    ).status(),
  ).toBe(400);
  const report = await (
    await admin.get(
      `/api/erp/reports?period=month&year=${day.slice(0, 4)}&month=${day.slice(5, 7)}`,
    )
  ).json();
  expect(report.revenue).toBeGreaterThanOrEqual(25000);
  expect(report.methods.CASH).toBeGreaterThanOrEqual(25000);
  const card = await (
    await doctor.get(`/api/erp/patients/${patientId}`)
  ).json();
  expect(card.treatments[0].tooth).toBe(16);
  expect(card.payments).toBeUndefined();
});
test("inventory atomic stock, documents and export files", async () => {
  const item = await post(admin, "/api/erp/inventory", {
    name: "QA Бээлий",
    sku: randomUUID(),
    unit: "ш",
    minimum: 5,
  });
  expect(item.status()).toBe(201);
  const itemId = (await item.json()).id;
  expect(
    (
      await post(admin, "/api/erp/movements", {
        itemId,
        quantity: 10,
        reason: "Нийлүүлэлт",
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await post(admin, "/api/erp/movements", {
        itemId,
        quantity: -11,
        reason: "Зарлага",
      })
    ).status(),
  ).toBe(409);
  expect(
    (await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } }))
      .quantity,
  ).toBe(10);
  const document = await post(reception, "/api/erp/documents", {
    patientId,
    title: "QA Зөвшөөрөл",
    type: "CONSENT",
    content: "Эмчилгээний зөвшөөрлийн жишээ текст.",
    consentName: "QA Өвчтөн",
  });
  expect(document.status()).toBe(201);
  for (const url of [
    `/api/export/patient?id=${patientId}`,
    `/api/export/document?id=${(await document.json()).id}`,
    "/api/export/pdf?period=all",
  ]) {
    const res = await admin.get(url);
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.body()).subarray(0, 4).toString()).toBe("%PDF");
    expect((await res.body()).toString("latin1")).toContain("FontFile2");
  }
  const excel = await admin.get("/api/export/excel?period=all");
  expect(excel.status()).toBe(200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Uint8Array.from(await excel.body()).buffer);
  expect(book.getWorksheet("Төлбөр")!.rowCount).toBeGreaterThan(1);
});
test("public lookup is confirmed and contains booking fields only; CSRF blocked", async () => {
  const ctx = await playwrightRequest.newContext({ baseURL: origin });
  expect(
    (
      await post(ctx, "/api/public/lookup", {
        phone: phones.patient,
        confirmed: false,
      })
    ).status(),
  ).toBe(400);
  const res = await post(ctx, "/api/public/lookup", {
    phone: phones.patient,
    confirmed: true,
  });
  expect(res.status()).toBe(200);
  const result = await res.json();
  expect(result.appointments.length).toBeGreaterThan(0);
  for (const item of result.appointments) {
    expect(Object.keys(item).sort()).toEqual([
      "date",
      "doctor",
      "id",
      "service",
      "startTime",
      "status",
    ]);
  }
  expect(
    (
      await ctx.post("/api/public/booking", {
        headers: { Origin: "https://evil.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await ctx.dispose();
});
test("sidebar navigation leaves reports and follows the URL through back and forward", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill(phones.admin);
  await page.getByLabel("Нууц үг", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/erp$/);
  const nav = page.getByRole("navigation", { name: "Ажлын цэс" });
  for (const [label, path, heading] of [
    ["Тайлан", "/erp/reports", "Санхүү, үйл ажиллагааны тайлан"],
    ["Хяналтын самбар", "/erp", "Хяналтын самбар"],
    ["Өвчтөн", "/erp/patients", "Өвчтөний бүртгэл"],
    ["Тайлан", "/erp/reports", "Санхүү, үйл ажиллагааны тайлан"],
    ["Үйлчилгээ", "/erp/services", "Үйлчилгээ"],
  ]) {
    const link = nav.getByRole("link", { name: label, exact: true });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { level: 1, name: heading, exact: true }),
    ).toBeVisible();
    if (path !== "/erp/reports")
      await expect(page.getByLabel("Тайлангийн үйлчилгээ")).toHaveCount(0);
  }
  await page.goBack();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Санхүү, үйл ажиллагааны тайлан",
      exact: true,
    }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Үйлчилгээ",
      exact: true,
    }),
  ).toBeVisible();
});

test("admin dashboard, patient card and responsive public UI", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Утасны дугаар" }).fill(phones.admin);
  await page.getByLabel("Нууц үг", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/erp$/);
  await expect(
    page.getByRole("heading", { name: "Хяналтын самбар", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Нийт орлого", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-dashboard.png",
    fullPage: true,
  });
  await page.goto("/erp/patients");
  await page
    .getByPlaceholder("Нэр, утас, үйлчилгээ хайх…")
    .fill(phones.patient);
  await page.getByRole("button", { name: "QA Өвчтөн" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Шүдний схем · FDI")).toBeVisible();
  await page.getByRole("button", { name: "Хаах", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/erp");
  await expect(
    page.getByRole("heading", { name: "Хяналтын самбар", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/admin-mobile.png",
    fullPage: true,
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "BB Dental", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`QA Үзлэг ${phoneBase}`, { exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const serviceBox = await page
    .locator(".public-service-card")
    .first()
    .boundingBox();
  expect(serviceBox!.width / serviceBox!.height).toBeCloseTo(3 / 4, 2);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("public visitor completes three-step booking and checks phone-only appointment", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".public-service-card")
    .filter({ hasText: `QA Үзлэг ${phoneBase}` })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Эмч, өдөр, цагаа сонгох" }),
  ).toBeVisible();
  await page.locator(".public-booking-fields input[type=date]").fill(day);
  await page.locator(".public-booking-fields select").selectOption(doctorId);
  await page.locator(".public-time-slots button").first().click();
  await page.getByRole("button", { name: "Үргэлжлүүлэх", exact: true }).click();
  await page.getByLabel("Таны нэр").fill("QA Нийтийн захиалга");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill(phones.public);
  await page.getByRole("button", { name: "Захиалга илгээх" }).click();
  await expect(
    page.getByRole("heading", { name: "Таны захиалга бүртгэгдлээ" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Миний захиалгыг харах" }).click();
  await page.locator(".lookup-panel input").fill(phones.public);
  await page
    .locator(".lookup-panel")
    .getByRole("button", { name: "Үргэлжлүүлэх", exact: true })
    .click();
  await expect(
    page.getByText("— энэ дугаар зөв үү?", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Тийм, миний захиалгыг харуулах" })
    .click();
  await expect(page.locator(".lookup-results")).toContainText(
    `QA Үзлэг ${phoneBase}`,
  );
  await expect(page.locator(".lookup-results")).not.toContainText(
    "QA Нийтийн захиалга",
  );
});

test("admin staff changes revoke sessions and settings reach the public catalog", async () => {
  const phone = `99${phoneBase}7`;
  const created = await post(admin, "/api/erp/users", {
    name: "QA Шинэ ресепшн",
    phone,
    role: "RECEPTION",
    password,
  });
  expect(created.status(), await created.text()).toBe(201);
  const id = (await created.json()).id;
  const session = await login(phone);
  const disabled = await patch(admin, `/api/erp/users/${id}`, {
    name: "QA Шинэ ресепшн",
    phone,
    role: "RECEPTION",
    active: false,
  });
  expect(disabled.status(), await disabled.text()).toBe(200);
  expect((await session.get("/api/erp/patients")).status()).toBe(401);
  await session.dispose();
  expect(
    (
      await patch(admin, "/api/erp/settings/clinicName", {
        value: "BB Dental Clinic",
      })
    ).status(),
  ).toBe(200);
  const catalog = await (await admin.get("/api/public/catalog")).json();
  expect(catalog.clinic.clinicName).toBe("BB Dental Clinic");
});

test("doctors hand over a patient and persist attributed internal notes", async () => {
  expect(
    (
      await post(other, "/api/erp/patient-notes", {
        patientId,
        content: "Хандах эрхгүй",
      })
    ).status(),
  ).toBe(404);
  const note = await post(doctor, "/api/erp/patient-notes", {
    patientId,
    content: "Дотоод тэмдэглэл: давтан үзлэгт анхаарах.",
  });
  expect(note.status(), await note.text()).toBe(201);
  expect(
    (
      await post(doctor, "/api/erp/transfers", {
        patientId,
        sourceDoctorId: otherDoctorId,
        targetDoctorId: doctorId,
        reason: "Буруу эх үүсвэр",
      })
    ).status(),
  ).toBe(403);
  const transfer = await post(doctor, "/api/erp/transfers", {
    patientId,
    sourceDoctorId: doctorId,
    targetDoctorId: otherDoctorId,
    reason: "Нарийн мэргэжлийн эмчид шилжүүлэх",
  });
  expect(transfer.status(), await transfer.text()).toBe(201);
  const card = await (await other.get(`/api/erp/patients/${patientId}`)).json();
  expect(card.transfers[0].sourceDoctorId).toBe(doctorId);
  expect(card.notes[0].content).toContain("Дотоод тэмдэглэл");
  expect(card.notes[0].author.name).toBe("QA doctor");
  expect(
    card.treatments.some((t: { doctorId: string }) => t.doctorId === doctorId),
  ).toBe(true);
  expect(
    (
      await post(other, "/api/erp/patient-notes", {
        patientId,
        content: "Хүлээн авсан эмчийн тэмдэглэл",
      })
    ).status(),
  ).toBe(201);
  const visible = await (
    await other.get(`/api/erp/patients?q=${phones.patient}`)
  ).json();
  expect(visible.items.some((p: { id: string }) => p.id === patientId)).toBe(
    true,
  );
  expect(
    (await other.get(`/api/export/patient?id=${patientId}`)).status(),
  ).toBe(200);
  const lookup = await (
    await post(admin, "/api/public/lookup", {
      phone: phones.patient,
      confirmed: true,
    })
  ).json();
  expect(JSON.stringify(lookup)).not.toContain("Дотоод тэмдэглэл");
});

test("patient-card note entry and doctor transfer work in the browser", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill(phones.other);
  await page.getByLabel("Нууц үг", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto("/erp/patients");
  await page
    .getByPlaceholder("Нэр, утас, үйлчилгээ хайх…")
    .fill(phones.patient);
  await page.getByRole("button", { name: "QA Өвчтөн" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Эмнэлгийн дотоод тэмдэглэл" }),
  ).toBeVisible();
  await page
    .getByLabel("Дотоод тэмдэглэл бичих")
    .fill("UI дээр хадгалсан дотоод тэмдэглэл");
  await page
    .getByRole("button", { name: "Тэмдэглэл хадгалах", exact: true })
    .click();
  await expect(
    page.getByText("UI дээр хадгалсан дотоод тэмдэглэл", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Эмчид шилжүүлэх", exact: true })
    .click();
  await page.getByLabel("Хүлээн авах эмч").selectOption(doctorId);
  await page
    .getByLabel("Шилжүүлэх шалтгаан")
    .fill("Хяналтын үзлэгт буцааж шилжүүлэх");
  await page.getByRole("button", { name: "Шилжүүлэх", exact: true }).click();
  await expect(
    page.getByText("Өвчтөний карт хүлээн авах эмчид нээгдлээ.", {
      exact: true,
    }),
  ).toBeVisible();
  const stored = await db.patientNote.findFirst({
    where: { patientId, content: "UI дээр хадгалсан дотоод тэмдэглэл" },
  });
  expect(stored).not.toBeNull();
});

test("Cloudinary uploads enforce admin access, image formats and limits; branded PDFs include images", async () => {
  const upload = (
    ctx: APIRequestContext,
    purpose: string,
    buffer = asset,
    mimeType = "image/png",
  ) =>
    ctx.post("/api/upload", {
      headers: { Origin: origin },
      multipart: { purpose, file: { name: "photo.png", mimeType, buffer } },
    });
  expect((await upload(doctor, "doctors")).status()).toBe(201);
  expect((await upload(doctor, "logo")).status()).toBe(403);
  expect((await upload(doctor, "services")).status()).toBe(403);
  expect((await upload(reception, "services")).status()).toBe(403);
  const invalid = await upload(
    admin,
    "logo",
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    "image/png",
  );
  expect(invalid.status()).toBe(400);
  expect(
    (await upload(admin, "logo", Buffer.alloc(6 * 1024 * 1024))).status(),
  ).toBe(413);
  const photo = await upload(admin, "doctors");
  expect(photo.status(), await photo.text()).toBe(201);
  const image = (await photo.json()).url;
  expect(image).toContain("https://res.cloudinary.com/qa-cloud/image/upload/");
  expect(await photo.text()).not.toContain("qa-cloud-secret");
  expect(
    (
      await patch(admin, `/api/erp/doctors/${doctorId}`, {
        name: "QA doctor",
        specialty: "Шүдний эмч",
        imageUrl: image,
        active: true,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await patch(admin, `/api/erp/services/${serviceId}`, {
        name: `QA Үзлэг ${phoneBase}`,
        category: "Ерөнхий үзлэг",
        price: 25000,
        duration: 30,
        imageUrl: image,
      })
    ).status(),
  ).toBe(200);
  const logo = await upload(admin, "logo");
  expect(logo.status()).toBe(201);
  expect(
    (
      await patch(admin, "/api/erp/settings/logoUrl", {
        value: (await logo.json()).url,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await patch(admin, "/api/erp/settings/logoUrl", {
        value: "http://127.0.0.1/private-logo",
      })
    ).status(),
  ).toBe(400);
  const before = delivered;
  for (const [url, name] of [
    [`/api/export/patient?id=${patientId}`, "patient"],
    ["/api/export/pdf?period=all", "report"],
  ]) {
    const response = await admin.get(url);
    expect(response.status(), await response.text()).toBe(200);
    const bytes = await response.body();
    expect(bytes.toString("latin1")).toContain("/Subtype /Image");
    expect(bytes.toString("latin1")).toContain("FontFile2");
    await writeFile(`/private/tmp/bb-dental-${name}-preview.pdf`, bytes);
  }
  expect(delivered).toBeGreaterThan(before);
  failCloud = true;
  try {
    expect((await upload(admin, "services")).status()).toBe(502);
  } finally {
    failCloud = false;
  }
});

test("admin uploads service images and a PDF logo from the UI", async ({
  page,
}) => {
  await page.route("https://res.cloudinary.com/**", (route) =>
    route.fulfill({ contentType: "image/png", body: asset }),
  );
  await page.goto("/login");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill(phones.admin);
  await page.getByLabel("Нууц үг", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto("/erp/services");
  const row = page
    .getByRole("row")
    .filter({ hasText: `QA Үзлэг ${phoneBase}` });
  await row.getByRole("button", { name: "Засах", exact: true }).click();
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({
    name: "service.png",
    mimeType: "image/png",
    buffer: asset,
  });
  await expect(
    page
      .getByRole("dialog")
      .getByRole("img", { name: "Оруулсан зургийн урьдчилсан харагдац" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Хадгалах", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/erp/settings");
  await page
    .getByRole("button", { name: "Лого ба тайлан", exact: true })
    .click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: asset });
  await expect(page.getByRole("status")).toContainText("Лого хадгалагдлаа");
  const savedLogo = (
    await db.setting.findUniqueOrThrow({ where: { key: "logoUrl" } })
  ).value;
  await expect(page.locator(".erp-brand img")).toHaveAttribute(
    "src",
    savedLogo,
  );
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute(
    "href",
    savedLogo,
  );
  await expect(
    page.locator('head link[rel="apple-touch-icon"]'),
  ).toHaveAttribute("href", savedLogo);
  const branding = await page.request.get("/api/branding");
  expect(await branding.json()).toEqual({ logoUrl: savedLogo });
  expect(branding.headers()["cache-control"]).toBe("no-store");
  await page.goto("/");
  for (const logo of await page.locator(".brand-logo, .hero-logo").all())
    await expect(logo).toHaveAttribute("src", savedLogo);
  await expect(
    page
      .locator(".public-service-card")
      .filter({ hasText: `QA Үзлэг ${phoneBase}` })
      .getByRole("img"),
  ).toBeVisible();
  for (const path of [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ]) {
    await page.goto(path);
    await expect(page.locator(".login-story img")).toHaveAttribute(
      "src",
      savedLogo,
    );
  }
});

test("admin changes doctor, reception and admin roles while retaining clinical history", async () => {
  const doctor = await db.doctor.findUniqueOrThrow({
    where: { id: doctorId },
    include: { user: true },
  });
  const user = doctor.user!;
  const update = (role: string) =>
    patch(admin, `/api/erp/users/${user.id}`, {
      name: user.name,
      phone: user.phone,
      role,
      active: true,
    });
  const old = await login(user.phone);
  expect((await update("RECEPTION")).status()).toBe(200);
  expect((await old.get("/api/erp/appointments")).status()).toBe(401);
  await old.dispose();
  expect(
    (await db.doctor.findUniqueOrThrow({ where: { id: doctorId } })).active,
  ).toBe(false);
  expect(
    (await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } }))
      .doctorId,
  ).toBe(doctorId);
  const receptionSession = await login(user.phone);
  expect((await receptionSession.get("/api/erp/payments")).status()).toBe(200);
  expect((await receptionSession.get("/api/erp/users")).status()).toBe(403);
  await receptionSession.dispose();
  expect((await update("ADMIN")).status()).toBe(200);
  const adminSession = await login(user.phone);
  expect((await adminSession.get("/api/erp/users")).status()).toBe(200);
  await adminSession.dispose();
  expect((await update("DOCTOR")).status()).toBe(200);
  expect(
    (await db.doctor.findUniqueOrThrow({ where: { userId: user.id } })).id,
  ).toBe(doctorId);
  expect(
    (await db.doctor.findUniqueOrThrow({ where: { id: doctorId } })).active,
  ).toBe(true);
  const actor = await db.user.findUniqueOrThrow({
    where: { phone: phones.admin },
  });
  const others = await db.user.findMany({
    where: { id: { not: actor.id }, role: "ADMIN", active: true },
  });
  await db.user.updateMany({
    where: { id: { in: others.map((u) => u.id) } },
    data: { active: false },
  });
  try {
    expect(
      (
        await patch(admin, `/api/erp/users/${actor.id}`, {
          name: actor.name,
          phone: actor.phone,
          role: "RECEPTION",
          active: true,
        })
      ).status(),
    ).toBe(400);
  } finally {
    await db.user.updateMany({
      where: { id: { in: others.map((u) => u.id) } },
      data: { active: true },
    });
  }
});

test("footer settings are editable and employee directory is responsive", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill(phones.admin);
  await page.getByLabel("Нууц үг", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto("/erp/users");
  await page.getByLabel("Ажилтан хайх").fill(phones.reception);
  const card = page
    .locator(".employee-card")
    .filter({ hasText: phones.reception });
  await card.getByRole("button", { name: "Эрх солих" }).click();
  await page.getByRole("dialog").getByLabel("Олгох эрх").selectOption("DOCTOR");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Хадгалах", exact: true })
    .click();
  await expect(card).toContainText("Эмч");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".erp-sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/employees-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Ажилтан хайх").fill("");
  await page.screenshot({
    path: "test-results/employees-desktop.png",
    fullPage: true,
  });
  await page.goto("/erp/settings");
  await page
    .getByLabel("Холбоо барих имэйл", { exact: true })
    .fill("frontdesk@example.com");
  await page
    .getByLabel("Эмнэлгийн товч танилцуулга", { exact: true })
    .fill("BB Dental · Таны гэр бүлийн эрүүл инээмсэглэл.");
  await page
    .getByLabel("Цаг захиалах товчны текст", { exact: true })
    .fill("Үзлэгээ товлох");
  await page
    .getByRole("button", { name: "Өөрчлөлт хадгалах", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "footer-ийн мэдээлэл хадгалагдлаа",
  );
  await page.screenshot({
    path: "test-results/settings-footer.png",
    fullPage: true,
  });
  await page.goto("/");
  await expect(page.locator("footer")).toContainText("frontdesk@example.com");
  await expect(page.locator("footer")).toContainText(
    "Таны гэр бүлийн эрүүл инээмсэглэл",
  );
  await expect(
    page.locator("footer").getByRole("link", { name: "Үзлэгээ товлох" }),
  ).toBeVisible();
  const limited = await login(phones.reception);
  expect(
    (
      await patch(limited, "/api/erp/settings/clinic", {
        email: "bad@example.com",
      })
    ).status(),
  ).toBe(403);
  await limited.dispose();
});

test("Telegram settings protect the token, respect toggles, and link staff with a secret webhook", async () => {
  const token = "123456:qa_database_token_12345678901234567890";
  expect(
    (
      await post(admin, "/api/erp/telegram-settings", {
        action: "save",
        token,
        booking: true,
        transfer: true,
        recovery: true,
      })
    ).status(),
  ).toBe(200);
  const stored = await db.setting.findUniqueOrThrow({
    where: { key: "telegramBotTokenEncrypted" },
  });
  expect(stored.value).not.toContain(token);
  const settings = await admin.get("/api/erp/settings");
  expect(await settings.text()).not.toContain(stored.value);
  expect(await settings.text()).not.toContain("telegramBotTokenEncrypted");
  const status = await admin.get("/api/erp/telegram-settings");
  expect(await status.text()).not.toContain(token);
  expect((await status.json()).source).toBe("database");
  expect(
    (
      await post(other, "/api/erp/telegram-settings", { action: "test" })
    ).status(),
  ).toBe(403);
  const target = await db.user.findUniqueOrThrow({
    where: { phone: phones.other },
  });
  const link = await post(admin, `/api/erp/telegram-link/${target.id}`, {});
  expect(link.status()).toBe(200);
  const code = new URL((await link.json()).url).searchParams.get("start")!;
  // The webhook secret is obtained from the same signed configuration used by the app.
  const { createHmac } = await import("node:crypto");
  const secret = createHmac(
    "sha256",
    Buffer.from(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "hex",
    ),
  )
    .update("bb-dental-telegram-webhook-v1")
    .digest("hex");
  const event = {
    message: {
      chat: { id: 123456789, type: "private" },
      text: `/start ${code}`,
    },
  };
  expect(
    (await admin.post("/api/telegram/webhook", { data: event })).status(),
  ).toBe(401);
  expect(
    (
      await admin.post("/api/telegram/webhook", {
        headers: { "x-telegram-bot-api-secret-token": secret },
        data: event,
      })
    ).status(),
  ).toBe(200);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: target.id } }))
      .telegramChatId,
  ).toBe("123456789");
  expect(
    (await db.doctor.findUniqueOrThrow({ where: { userId: target.id } }))
      .telegramChatId,
  ).toBe("123456789");
  await admin.post("/api/telegram/webhook", {
    headers: { "x-telegram-bot-api-secret-token": secret },
    data: {
      message: {
        chat: { id: 987654321, type: "private" },
        text: `/start ${code}`,
      },
    },
  });
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: target.id } }))
      .telegramChatId,
  ).toBe("123456789");
  expect(
    (
      await post(admin, `/api/erp/telegram-user-test/${target.id}`, {})
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(admin, "/api/erp/telegram-settings", {
        action: "save",
        booking: false,
        transfer: false,
        recovery: false,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(admin, `/api/erp/user-password-reset/${target.id}`, {})
    ).status(),
  ).toBe(503);
  expect(
    (
      await post(admin, "/api/erp/telegram-settings", {
        action: "save",
        booking: true,
        transfer: true,
        recovery: true,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(admin, "/api/erp/telegram-settings", {
        action: "webhook-status",
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(admin, "/api/erp/telegram-settings", {
        action: "webhook-install",
      })
    ).status(),
  ).toBe(200);
  expect(webhookState.url).toBe(
    "https://clinic.example.test/api/telegram/webhook",
  );
  expect(webhookState.secret).toBe(secret);
  expect(
    (
      await post(admin, "/api/erp/telegram-settings", {
        action: "webhook-remove",
      })
    ).status(),
  ).toBe(200);
});

test("Telegram configuration and staff linking work in the redesigned settings UI", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill(phones.admin);
  await page.getByLabel("Нууц үг", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto("/erp/settings");
  await page.getByRole("button", { name: "Telegram", exact: true }).click();
  await page
    .getByRole("button", { name: "Bot холболт шалгах", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Telegram bot холболт амжилттай",
  );
  await expect(page.getByText("BB Dental QA", { exact: true })).toBeVisible();
  await page.getByLabel("Шинэ болон шилжүүлсэн цаг", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Тохиргоо хадгалах", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await db.setting.findUnique({
            where: { key: "telegramBookingEnabled" },
          })
        )?.value,
    )
    .toBe("false");
  await page.getByLabel("Шинэ болон шилжүүлсэн цаг", { exact: true }).check();
  await page
    .getByRole("button", { name: "Тохиргоо хадгалах", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await db.setting.findUnique({
            where: { key: "telegramBookingEnabled" },
          })
        )?.value,
    )
    .toBe("true");
  await page
    .getByRole("button", { name: "Webhook холбох", exact: true })
    .click();
  await expect(
    page.locator("p").filter({
      hasText: "https://clinic.example.test/api/telegram/webhook",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/settings-telegram.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".erp-sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/settings-telegram-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/erp/users");
  await page.getByLabel("Ажилтан хайх").fill(phones.other);
  const card = page.locator(".employee-card").filter({ hasText: phones.other });
  await card.locator(".employee-menu summary").click();
  await card
    .getByRole("button", { name: "Telegram холбох", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Telegram холбох холбоос"),
  ).toHaveValue(/https:\/\/t\.me\/BBQaBot\?start=[a-f0-9]{48}/);
});

let focusedServiceId: string;
test("service eligibility drives suggestions and booking duration stays internal", async () => {
  const create = await post(admin, "/api/erp/services", {
    name: `QA Тусгай ${phoneBase}`,
    category: "Тусгай",
    price: 55000,
    duration: 75,
    doctorIds: [doctorId],
  });
  expect(create.status(), await create.text()).toBe(201);
  focusedServiceId = (await create.json()).id;
  const catalog = await (await admin.get("/api/public/catalog")).json();
  const service = catalog.services.find(
    (s: { id: string }) => s.id === focusedServiceId,
  );
  expect(service).not.toHaveProperty("duration");
  const result = await (
    await admin.get(
      `/api/public/suggestions?serviceId=${focusedServiceId}&date=${day}`,
    )
  ).json();
  expect(result.suggestions).toHaveLength(1);
  expect(result.suggestions[0].doctor.id).toBe(doctorId);
  const slot = result.suggestions[0].slots[0];
  expect(slot).toBeTruthy();
  expect(
    (
      await post(admin, "/api/public/booking", {
        name: "QA Suggested",
        phone: phones.public,
        doctorId: otherDoctorId,
        serviceId: focusedServiceId,
        date: day,
        startTime: slot,
      })
    ).status(),
  ).toBe(409);
  await db.doctor.update({
    where: { id: doctorId },
    data: { telegramChatId: "22334455" },
  });
  const response = await post(admin, "/api/public/booking", {
    name: "QA Suggested",
    phone: phones.public,
    doctorId,
    serviceId: focusedServiceId,
    date: day,
    startTime: slot,
  });
  expect(response.status(), await response.text()).toBe(201);
  const id = (await response.json()).id;
  const appointment = await db.appointment.findUniqueOrThrow({ where: { id } });
  const mins = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  expect(mins(appointment.endTime) - mins(slot)).toBe(75);
  const next = await (
    await admin.get(
      `/api/public/availability?doctorId=${doctorId}&serviceId=${focusedServiceId}&date=${day}`,
    )
  ).json();
  expect(
    next.slots.some((s: string) => s >= slot && s < appointment.endTime),
  ).toBe(false);
  const lookup = await (
    await post(admin, "/api/public/lookup", {
      phone: phones.public,
      confirmed: true,
    })
  ).json();
  expect(
    lookup.appointments.find((a: { id: string }) => a.id === id),
  ).not.toHaveProperty("endTime");
});

test("Telegram booking buttons check the doctor, stale schedule and terminal states", async () => {
  const { createHmac } = await import("node:crypto");
  const secret = createHmac(
    "sha256",
    Buffer.from(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "hex",
    ),
  )
    .update("bb-dental-telegram-webhook-v1")
    .digest("hex");
  const message = telegramCalls
    .filter(
      (c) =>
        c.method === "sendMessage" && String(c.data.text).includes("QA Тусгай"),
    )
    .at(-1)!;
  expect(message.data.chat_id).toBe("22334455");
  expect(message.data.text).toContain("🦷 ШИНЭ ЦАГИЙН ЗАХИАЛГА");
  expect(message.data.text).toContain(`📞 Утас: ${phones.public}`);
  expect(message.data.text).toContain("👨‍⚕️ Эмч:");
  const markup = message.data.reply_markup as {
    inline_keyboard: { callback_data: string }[][];
  };
  const confirm = markup.inline_keyboard[0][0].callback_data;
  const cancel = markup.inline_keyboard[0][1].callback_data;
  expect(Buffer.byteLength(confirm)).toBeLessThanOrEqual(64);
  const id = confirm.split(":")[2];
  const callback = (data: string, chat = 22334455) =>
    admin.post("/api/telegram/webhook", {
      headers: { "x-telegram-bot-api-secret-token": secret },
      data: {
        callback_query: {
          id: randomUUID(),
          from: { id: chat },
          data,
          message: { message_id: 17, chat: { id: chat, type: "private" } },
        },
      },
    });
  expect((await callback(confirm, 123456789)).status()).toBe(200);
  expect(
    (await db.appointment.findUniqueOrThrow({ where: { id } })).status,
  ).toBe("PENDING");
  const results = await Promise.all([callback(confirm), callback(confirm)]);
  expect(results.every((r) => r.status() === 200)).toBe(true);
  expect(
    (await db.appointment.findUniqueOrThrow({ where: { id } })).status,
  ).toBe("CONFIRMED");
  expect(
    await db.auditLog.count({
      where: { entityId: id, action: "TELEGRAM_CONFIRM" },
    }),
  ).toBe(1);
  const available = await (
    await admin.get(
      `/api/public/availability?doctorId=${doctorId}&serviceId=${focusedServiceId}&date=${day}`,
    )
  ).json();
  expect(
    (
      await post(admin, `/api/erp/reschedule/${id}`, {
        doctorId,
        serviceId: focusedServiceId,
        date: day,
        startTime: available.slots[0],
      })
    ).status(),
  ).toBe(201);
  expect((await callback(cancel)).status()).toBe(200);
  expect(
    (await db.appointment.findUniqueOrThrow({ where: { id } })).status,
  ).toBe("CONFIRMED");
  const latest = telegramCalls
    .filter(
      (c) =>
        c.method === "sendMessage" && String(c.data.text).includes("QA Тусгай"),
    )
    .at(-1)!;
  const updated = (latest.data.reply_markup as typeof markup)
    .inline_keyboard[0][1].callback_data;
  expect(updated).not.toBe(cancel);
  expect((await callback(updated)).status()).toBe(200);
  expect(
    (await db.appointment.findUniqueOrThrow({ where: { id } })).status,
  ).toBe("CANCELLED");
  await callback(confirm);
  expect(
    (await db.appointment.findUniqueOrThrow({ where: { id } })).status,
  ).toBe("CANCELLED");
});

test("roster permissions and service-specific exports preserve exact financial totals", async () => {
  const denied = await post(other, "/api/erp/nurse-shifts", {
    name: "QA Nurse",
    date: day,
    startTime: "09:00",
    endTime: "18:00",
  });
  expect(denied.status()).toBe(403);
  const nurse = await post(admin, "/api/erp/nurse-shifts", {
    name: `QA Сувилагч ${phoneBase}`,
    date: day,
    startTime: "09:00",
    endTime: "18:00",
  });
  expect(nurse.status()).toBe(201);
  expect(
    (
      await post(admin, "/api/erp/nurse-shifts", {
        name: `QA Сувилагч ${phoneBase}`,
        date: day,
        startTime: "10:00",
        endTime: "17:00",
      })
    ).status(),
  ).toBe(409);
  const roster = await (
    await admin.get(`/api/erp/roster?from=${day}&to=${day}`)
  ).json();
  expect(roster.doctors.some((d: { id: string }) => d.id === doctorId)).toBe(
    true,
  );
  expect(
    roster.nurses.some(
      (n: { name: string }) => n.name === `QA Сувилагч ${phoneBase}`,
    ),
  ).toBe(true);
  const own = await (
    await other.get(`/api/erp/roster?from=${day}&to=${day}`)
  ).json();
  expect(own.doctors.every((d: { id: string }) => d.id === otherDoctorId)).toBe(
    true,
  );
  const report = await (
    await admin.get(`/api/erp/reports?period=all&serviceId=${serviceId}`)
  ).json();
  expect(report.byService).toHaveLength(1);
  expect(report.byService[0].id).toBe(serviceId);
  expect(report.byService[0].revenue).toBe(report.revenue);
  expect(report.expense).toBe(0);
  const excel = await admin.get(
    `/api/export/excel?period=all&serviceId=${serviceId}`,
  );
  expect(excel.status()).toBe(200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    (await excel.body()) as unknown as Parameters<typeof book.xlsx.load>[0],
  );
  expect(book.getWorksheet("Үйлчилгээгээр")?.getRow(2).getCell(1).value).toBe(
    report.byService[0].name,
  );
  expect(
    (
      await admin.get(`/api/export/pdf?period=all&serviceId=${serviceId}`)
    ).status(),
  ).toBe(200);
});

test("guided dental chart, team calendar and persistent dark theme work for staff", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill(phones.admin);
  await page.getByLabel("Нууц үг", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/erp$/);
  await expect(page.locator(".role-actions")).toContainText("Багийн хуваарь");
  await page.goto("/erp/schedules");
  await page.getByLabel("Хуваарийн сар").fill(day.slice(0, 7));
  await page.getByRole("button", { name: new RegExp(`^${day}:`) }).click();
  await expect(page.locator(".roster-day-detail")).toContainText(
    `QA Сувилагч ${phoneBase}`,
  );
  await page.locator(".roster-person").first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "Долоо хоногийн тогтмол хуваарь",
  );
  await page.getByRole("button", { name: "Хаах", exact: true }).click();
  await page.getByRole("button", { name: "Бараан горим", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "test-results/team-calendar-dark.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/erp/treatments");
  await page.getByRole("button", { name: "Шинээр нэмэх", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Шүд 16", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Шүд 16", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Сүүн шүд", exact: true }).click();
  await dialog.getByRole("button", { name: "Шүд 55", exact: true }).click();
  await expect(dialog.getByText("Сонгосон шүд: 55")).toBeVisible();
  await page.screenshot({ path: "test-results/fdi-dark.png", fullPage: true });
  await page.getByRole("button", { name: "Хаах", exact: true }).click();
  await page.goto("/erp/reports");
  await page.getByLabel("Тайлангийн үйлчилгээ").selectOption(serviceId);
  await expect(page.locator(".service-report tbody tr")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".erp-sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/report-dark-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Гэрэлтэй горим", exact: true })
    .click();
});

test("role workspaces show focused actions and public suggested times complete the selection", async ({
  page,
  browser,
}) => {
  const receptionPhone = `88${phoneBase}7`;
  const create = await post(admin, "/api/erp/users", {
    name: "QA Desk",
    phone: receptionPhone,
    role: "RECEPTION",
    password,
    active: true,
  });
  expect(create.status()).toBe(201);
  const desk = await login(receptionPhone);
  for (const [session, role] of [
    [other, "DOCTOR"],
    [desk, "RECEPTION"],
  ] as const) {
    const context = await browser.newContext({
      storageState: await session.storageState(),
      viewport: { width: 1440, height: 1000 },
    });
    const staffPage = await context.newPage();
    await staffPage.goto(`${origin}/erp`);
    await expect(staffPage.locator(".role-actions")).toContainText(
      role === "DOCTOR" ? "Миний үзлэг" : "Касс, төлбөр",
    );
    await staffPage
      .getByRole("button", { name: "Бараан горим", exact: true })
      .click();
    await expect(staffPage.locator(".metric-grid")).toBeVisible();
    await expect(staffPage.locator(".role-actions")).toBeVisible();
    await staffPage.screenshot({
      path: `test-results/${role.toLowerCase()}-workspace-dark.png`,
      fullPage: true,
    });
    await staffPage.goto(`${origin}/erp/calendar`);
    await expect(
      staffPage.getByRole("heading", { name: "Хэн, хэзээ ажиллах вэ?" }),
    ).toBeVisible();
    await context.close();
  }
  await desk.dispose();
  await page.goto("/");
  await page
    .locator(".public-service-card")
    .filter({ hasText: `QA Тусгай ${phoneBase}` })
    .click();
  await page.locator(".public-booking-fields input[type=date]").fill(day);
  await expect(page.locator(".suggestion-list article")).toHaveCount(1);
  await expect(page.locator(".booking-selected-service")).not.toContainText(
    "минут",
  );
  await page.locator(".suggestion-list article button").first().click();
  await expect(page.locator(".public-time-slots button.selected")).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Үргэлжлүүлэх", exact: true }).click();
  await expect(page.locator(".public-booking-summary")).toContainText(
    `QA Тусгай ${phoneBase}`,
  );
  await page.getByRole("button", { name: "Бараан горим", exact: true }).click();
  await page.screenshot({
    path: "test-results/suggested-booking-dark.png",
    fullPage: true,
  });
});

test("self profile edits stay scoped and doctor changes reach the public catalog", async ({
  page,
  browser,
}) => {
  const phone = `88${phoneBase}8`;
  expect(
    (
      await post(admin, "/api/erp/users", {
        name: "QA Profile Doctor",
        phone,
        password,
        role: "DOCTOR",
        active: true,
      })
    ).status(),
  ).toBe(201);
  const self = await login(phone);
  const before = await (await self.get("/api/profile")).json();
  expect(before.name).toBe("QA Profile Doctor");
  expect(before).not.toHaveProperty("passwordHash");
  expect(before).not.toHaveProperty("sessions");
  const doctorBefore = await db.doctor.findUniqueOrThrow({
    where: { id: doctorId },
  });
  const fields = {
    name: "QA Өөрийн профайл",
    phone,
    email: `self-${phoneBase}@example.com`,
    telegramChatId: "12344321",
    specialty: "Гажиг заслын эмч",
    bio: "Өөрийн танилцуулгыг шинэчилсэн.",
  };
  expect(
    (await patch(self, "/api/profile", { ...fields, role: "ADMIN" })).status(),
  ).toBe(400);
  expect(
    (await patch(self, "/api/profile", { ...fields, id: before.id })).status(),
  ).toBe(400);
  expect(
    (
      await self.patch("/api/profile", {
        headers: { Origin: "https://bad.example" },
        data: fields,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await patch(self, "/api/profile", { ...fields, phone: phones.admin })
    ).status(),
  ).toBe(409);
  expect((await patch(self, "/api/profile", fields)).status()).toBe(200);
  const current = await db.user.findUniqueOrThrow({
    where: { id: before.id },
    include: { doctor: true },
  });
  expect(current.role).toBe("DOCTOR");
  expect(current.doctor?.name).toBe(fields.name);
  expect(current.doctor?.telegramChatId).toBe("12344321");
  expect(
    (await db.doctor.findUniqueOrThrow({ where: { id: doctorId } })).name,
  ).toBe(doctorBefore.name);
  const catalog = await (await self.get("/api/public/catalog")).json();
  expect(
    catalog.doctors.find((d: { id: string }) => d.id === current.doctor!.id)
      .bio,
  ).toBe(fields.bio);
  const denied = await playwrightRequest.newContext({ baseURL: origin });
  expect((await denied.get("/api/profile")).status()).toBe(401);
  await denied.dispose();
  expect(
    (
      await post(admin, "/api/erp/users", {
        name: "QA Profile Desk",
        phone: `88${phoneBase}9`,
        password,
        role: "RECEPTION",
        active: true,
      })
    ).status(),
  ).toBe(201);
  const desk = await login(`88${phoneBase}9`);
  expect((await desk.get("/api/profile")).status()).toBe(403);
  expect((await patch(desk, "/api/profile", fields)).status()).toBe(403);
  await desk.dispose();
  const context = await browser.newContext({
    storageState: await self.storageState(),
  });
  const doctorPage = await context.newPage();
  await doctorPage.goto(`${origin}/erp`);
  await doctorPage
    .getByRole("link", { name: "Миний профайл засах", exact: true })
    .click();
  await expect(doctorPage).toHaveURL(/\/erp\/profile$/);
  await doctorPage
    .getByLabel(/^Танилцуулга/)
    .fill("Browser-оос шинэчилсэн танилцуулга.");
  await doctorPage
    .getByRole("button", { name: "Профайл хадгалах", exact: true })
    .click();
  await expect(doctorPage.getByRole("status")).toContainText(
    "Профайл шинэчлэгдлээ",
  );
  await doctorPage.screenshot({
    path: "test-results/doctor-profile.png",
    fullPage: true,
  });
  await context.close();
  await self.dispose();
  await page.goto("/login");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill(phones.admin);
  await page.getByLabel("Нууц үг", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/erp$/);
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "GET") await hold;
    await route.continue();
  });
  await page.goto("/erp/profile");
  await expect(
    page.locator(".brand-loader:visible .brand-loader-word"),
  ).toHaveText("BB Dental");
  await page.screenshot({
    path: "test-results/bb-brand-loading.png",
    fullPage: true,
  });
  release();
  await page.getByLabel(/^Овог нэр/).fill("QA Admin Updated");
  await page
    .getByRole("button", { name: "Профайл хадгалах", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Профайл шинэчлэгдлээ");
  await expect(page.locator(".erp-user")).toContainText("QA Admin Updated");
  const branding = await (await page.request.get("/api/branding")).json();
  const logoUrl = branding.logoUrl || "/images/default-logo.png";
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute(
    "href",
    logoUrl,
  );
  await expect(
    page.locator('head link[rel="apple-touch-icon"]'),
  ).toHaveAttribute("href", logoUrl);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".erp-sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/admin-profile-mobile.png",
    fullPage: true,
  });
  await page.route("**/api/erp/services?**", (route) => route.abort());
  await page.goto("/erp/services");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".brand-loader:visible")).toHaveCount(0);
});
