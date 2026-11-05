import {
  createServer as createHttpServer,
  type Server as HttpServer,
} from "node:http";
import {
  test,
  expect,
  request as requests,
  type APIRequestContext,
} from "@playwright/test";
import { createServer, type Server } from "node:net";
import { randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
test.describe.configure({ mode: "serial" });
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.ERP_TEST_DATABASE_URL,
  }),
});
const origin = "http://localhost:3100";
const password = "12345678";
const tag = randomUUID().slice(0, 8);
let admin: APIRequestContext;
let staff: APIRequestContext;
let smtp: Server;
let doctorId: string;
let pendingId: string;
const messages: string[] = [];
const telegramMessages: { chat_id: string; text: string }[] = [];
let telegramServer: HttpServer;
let failTelegram = false;
const candidates = [
  {
    name: "QA Анхны ажилтан A",
    phone: "98112233",
    email: `first-${tag}@example.com`,
    telegramChatId: "12345678",
    password,
    passwordConfirmation: password,
    requestedRole: "DOCTOR",
  },
  {
    name: "QA Анхны ажилтан B",
    phone: "98112234",
    email: `second-${tag}@example.com`,
    telegramChatId: "87654321",
    password,
    passwordConfirmation: password,
    requestedRole: "DOCTOR",
  },
];
let pending = candidates[0];
let firstAdmin = candidates[0];
const post = (ctx: APIRequestContext, url: string, data: unknown) =>
  ctx.post(url, { headers: { Origin: origin }, data });
const login = async (phone: string, pass = password) => {
  const ctx = await requests.newContext({ baseURL: origin });
  const res = await post(ctx, "/api/auth/login", { phone, password: pass });
  expect(res.status(), await res.text()).toBe(200);
  return ctx;
};
test.beforeAll(async () => {
  expect(
    await db.user.count(),
    "First-registration tests require a fresh isolated test database.",
  ).toBe(0);
  telegramServer = createHttpServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      telegramMessages.push(JSON.parse(body));
      res.setHeader("Content-Type", "application/json");
      if (failTelegram) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ ok: false, description: "QA blocked recipient" }),
        );
      } else
        res.end(
          JSON.stringify({
            ok: true,
            result: { message_id: telegramMessages.length },
          }),
        );
    });
  });
  await new Promise<void>((resolve, reject) => {
    telegramServer.once("error", reject);
    telegramServer.listen(35360, "127.0.0.1", resolve);
  });
  smtp = createServer((socket) => {
    socket.write("220 localhost QA SMTP\r\n");
    let buffer = "";
    let inData = false;
    let data: string[] = [];
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n");
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === ".") {
            messages.push(data.join("\r\n"));
            data = [];
            inData = false;
            socket.write("250 Message queued\r\n");
          } else data.push(line);
          continue;
        }
        if (/^EHLO/i.test(line))
          socket.write("250-localhost\r\n250 PIPELINING\r\n");
        else if (/^DATA/i.test(line)) {
          inData = true;
          socket.write("354 End with dot\r\n");
        } else if (/^QUIT/i.test(line)) {
          socket.end("221 Bye\r\n");
        } else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(35359, "127.0.0.1", resolve);
  });
});
test.afterAll(async () => {
  await admin?.dispose();
  await staff?.dispose();
  if (smtp) await new Promise<void>((resolve) => smtp.close(() => resolve()));
  if (telegramServer)
    await new Promise<void>((resolve) => telegramServer.close(() => resolve()));
  await db.$disconnect();
});
test("concurrent first registrations create exactly one active admin", async () => {
  const ctx = await requests.newContext({ baseURL: origin });
  const responses = await Promise.all(
    candidates.map((data) => post(ctx, "/api/auth/register", data)),
  );
  for (const r of responses) expect(r.status(), await r.text()).toBe(201);
  const results = await Promise.all(responses.map((r) => r.json()));
  expect(results.filter((r) => r.first).length).toBe(1);
  const winner = results.findIndex((r) => r.first);
  pending = candidates[1 - winner];
  firstAdmin = candidates[winner];
  admin = await login(candidates[winner].phone);
  const record = await db.user.findUniqueOrThrow({
    where: { phone: pending.phone },
    include: { doctor: true },
  });
  pendingId = record.id;
  doctorId = record.doctor!.id;
  expect(record.approvalStatus).toBe("PENDING");
  expect(record.active).toBe(false);
  expect(record.doctor!.active).toBe(false);
  expect(
    (
      await post(ctx, "/api/auth/login", { phone: pending.phone, password })
    ).status(),
  ).toBe(403);
  const catalog = await (await ctx.get("/api/public/catalog")).json();
  expect(catalog.doctors.some((d: { id: string }) => d.id === doctorId)).toBe(
    false,
  );
  expect(
    (
      await post(ctx, "/api/auth/register", {
        ...pending,
        passwordConfirmation: "different",
      })
    ).status(),
  ).toBe(400);
  await ctx.dispose();
});
test("admin approval activates the requested doctor and registered Telegram ID", async () => {
  const res = await post(admin, `/api/erp/user-approval/${pendingId}`, {
    status: "APPROVED",
    role: "DOCTOR",
  });
  expect(res.status(), await res.text()).toBe(201);
  const user = await db.user.findUniqueOrThrow({
    where: { id: pendingId },
    include: { doctor: true },
  });
  expect(user.active).toBe(true);
  expect(user.approvalStatus).toBe("APPROVED");
  expect(user.doctor?.telegramChatId).toBe(pending.telegramChatId);
  expect(user.doctor?.active).toBe(true);
  staff = await login(pending.phone);
  expect(
    (
      await post(staff, `/api/erp/user-approval/${pendingId}`, {
        status: "APPROVED",
        role: "ADMIN",
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await post(admin, `/api/erp/user-approval/${pendingId}`, {
        status: "APPROVED",
        role: "DOCTOR",
      })
    ).status(),
  ).toBe(409);
});
function resetToken(raw: string) {
  let content = raw.split("\r\n\r\n").slice(1).join("\r\n\r\n");
  if (/Content-Transfer-Encoding: base64/i.test(raw))
    content = Buffer.from(content.replace(/\s/g, ""), "base64").toString();
  else
    content = content
      .replace(/=\r\n/g, "")
      .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      );
  const token = content.match(/reset-password\?token=([a-f0-9]{64})/)?.[1];
  expect(token).toBeTruthy();
  return token!;
}
test("emailed reset tokens expire, work once and revoke all previous sessions", async () => {
  const res = await post(admin, "/api/auth/forgot-password", {
    email: pending.email,
  });
  expect(res.status(), await res.text()).toBe(200);
  await expect.poll(() => messages.length).toBe(1);
  const token = resetToken(messages[0]);
  const stored = await db.passwordReset.findUniqueOrThrow({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
  });
  expect(stored.tokenHash).not.toBe(token);
  const unknown = await post(admin, "/api/auth/forgot-password", {
    email: `unknown-${tag}@example.com`,
  });
  expect(await unknown.json()).toEqual(await res.json());
  expect(messages.length).toBe(1);
  const data = {
    token,
    password: "newpass8",
    passwordConfirmation: "newpass8",
  };
  expect(
    (
      await post(admin, "/api/auth/reset-password", {
        ...data,
        passwordConfirmation: "mismatch",
      })
    ).status(),
  ).toBe(400);
  expect((await post(admin, "/api/auth/reset-password", data)).status()).toBe(
    200,
  );
  expect((await staff.get("/api/erp/patients")).status()).toBe(401);
  expect((await post(admin, "/api/auth/reset-password", data)).status()).toBe(
    400,
  );
  const ctx = await requests.newContext({ baseURL: origin });
  expect(
    (
      await post(ctx, "/api/auth/login", { phone: pending.phone, password })
    ).status(),
  ).toBe(401);
  await ctx.dispose();
  const fresh = await login(pending.phone, "newpass8");
  await fresh.dispose();
  expect(
    (
      await post(admin, "/api/auth/forgot-password", { email: pending.email })
    ).status(),
  ).toBe(200);
  await expect.poll(() => messages.length).toBe(2);
  const expired = resetToken(messages[1]);
  await db.passwordReset.updateMany({
    where: { userId: pendingId, usedAt: null },
    data: { expiresAt: new Date(0) },
  });
  expect(
    (
      await post(admin, "/api/auth/reset-password", { ...data, token: expired })
    ).status(),
  ).toBe(400);
});
test("registration and login show password visibility controls and pending review", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Овог нэр", { exact: true }).fill("QA Бүртгэл UI");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill("98112235");
  await page.getByLabel("Имэйл", { exact: true }).fill(`ui-${tag}@example.com`);
  await page.getByLabel("Нууц үг", { exact: true }).fill(password);
  await page.getByLabel("Нууц үг давтах", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Нууц үг харах", exact: true })
    .click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Нууц үг нуух", exact: true }).click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute(
    "type",
    "password",
  );
  await page
    .getByRole("button", { name: "Бүртгэл үүсгэх", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Админ хянасны дараа идэвхжинэ",
  );
  await page.goto("/login");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill("98112235");
  await page.getByLabel("Нууц үг", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page.locator(".login-form .erp-alert")).toContainText(
    "зөвшөөрөл хүлээж байна",
  );
  await expect(
    page.getByRole("link", { name: "Нууц үг мартсан?" }),
  ).toBeVisible();
});

test("admin reviews a registration in the UI and the approved employee resets their password", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Утасны дугаар", { exact: true })
    .fill(firstAdmin.phone);
  await page.getByLabel("Нууц үг", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto("/erp/users");
  const row = page.locator(".employee-card").filter({ hasText: "98112235" });
  await row.getByRole("button", { name: "Хянах" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Олгох эрх")
    .selectOption("RECEPTION");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Хадгалах", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(row).toContainText("Идэвхтэй");
  await page.goto("/forgot-password");
  await page.getByLabel("Сэргээх арга", { exact: true }).selectOption("email");
  await page.getByLabel("Имэйл", { exact: true }).fill(`ui-${tag}@example.com`);
  await page.getByRole("button", { name: "Сэргээх холбоос авах" }).click();
  await expect(page.getByRole("status")).toContainText("сэргээх холбоос");
  await expect.poll(() => messages.length).toBe(3);
  const token = resetToken(messages[2]);
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel("Нууц үг", { exact: true }).fill("reset888");
  await page.getByLabel("Нууц үг давтах", { exact: true }).fill("reset888");
  await page.getByRole("button", { name: "Нууц үг шинэчлэх" }).click();
  await expect(page.getByRole("status")).toContainText("Нууц үг шинэчлэгдлээ");
  await page.goto("/login");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill("98112235");
  await page.getByLabel("Нууц үг", { exact: true }).fill("reset888");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/erp$/);
});

test("public Telegram recovery sends to the saved chat and its one-use link revokes sessions", async ({
  page,
}) => {
  const before = telegramMessages.length;
  const previous = await login(pending.phone, "newpass8");
  await page.goto("/forgot-password");
  await expect(page.getByLabel("Сэргээх арга", { exact: true })).toHaveValue(
    "telegram",
  );
  await page.getByLabel("Бүртгэлтэй утас", { exact: true }).fill(pending.phone);
  await page.getByRole("button", { name: "Сэргээх холбоос авах" }).click();
  await expect(page.getByRole("status")).toContainText("бүртгэлтэй Telegram");
  await expect.poll(() => telegramMessages.length).toBe(before + 1);
  const message = telegramMessages.at(-1)!;
  expect(message.chat_id).toBe(pending.telegramChatId);
  const token = message.text.match(/reset-password\?token=([a-f0-9]{64})/)?.[1];
  expect(token).toBeTruthy();
  const unknown = await post(admin, "/api/auth/forgot-password", {
    channel: "telegram",
    phone: "98999999",
    telegramChatId: "11111111",
  });
  expect(unknown.status()).toBe(200);
  expect((await unknown.json()).message).toContain("бүртгэлтэй Telegram");
  expect(telegramMessages.length).toBe(before + 1);
  const stored = await db.passwordReset.findUniqueOrThrow({
    where: { tokenHash: createHash("sha256").update(token!).digest("hex") },
  });
  expect(stored.tokenHash).not.toBe(token);
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel("Нууц үг", { exact: true }).fill("telegram8");
  await page.getByLabel("Нууц үг давтах", { exact: true }).fill("telegram8");
  await page.getByRole("button", { name: "Нууц үг шинэчлэх" }).click();
  await expect(page.getByRole("status")).toContainText("Нууц үг шинэчлэгдлээ");
  expect((await previous.get("/api/erp/patients")).status()).toBe(401);
  await previous.dispose();
  expect(
    (
      await post(admin, "/api/auth/reset-password", {
        token,
        password: "again888",
        passwordConfirmation: "again888",
      })
    ).status(),
  ).toBe(400);
});

test("admin can send a recovery link from the user list while other roles cannot", async ({
  page,
}) => {
  const doctor = await login(pending.phone, "telegram8");
  expect(
    (
      await post(doctor, `/api/erp/user-password-reset/${pendingId}`, {})
    ).status(),
  ).toBe(403);
  await doctor.dispose();
  const missing = await db.user.findUniqueOrThrow({
    where: { phone: "98112235" },
  });
  expect(
    (
      await post(admin, `/api/erp/user-password-reset/${missing.id}`, {})
    ).status(),
  ).toBe(422);
  const before = telegramMessages.length;
  await page.goto("/login");
  await page
    .getByLabel("Утасны дугаар", { exact: true })
    .fill(firstAdmin.phone);
  await page.getByLabel("Нууц үг", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/erp$/);
  await page.goto("/erp/users");
  const row = page.locator(".employee-card").filter({ hasText: pending.phone });
  await row.locator(".employee-menu summary").click();
  await row
    .getByRole("button", {
      name: "Telegram руу сэргээх холбоос илгээх",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "бүртгэлтэй Telegram руу илгээгдлээ",
  );
  await expect.poll(() => telegramMessages.length).toBe(before + 1);
  expect(telegramMessages.at(-1)!.chat_id).toBe(pending.telegramChatId);
  const log = await db.auditLog.findFirst({
    where: { action: "ADMIN_PASSWORD_RESET_SENT", entityId: pendingId },
  });
  expect(log).not.toBeNull();
});

test("failed Telegram recovery delivery revokes the undelivered token", async () => {
  failTelegram = true;
  try {
    const response = await post(
      admin,
      `/api/erp/user-password-reset/${pendingId}`,
      { telegramChatId: "11111111" },
    );
    expect(response.status(), await response.text()).toBe(503);
    const message = telegramMessages.at(-1)!;
    expect(message.chat_id).toBe(pending.telegramChatId);
    const token = message.text.match(
      /reset-password\?token=([a-f0-9]{64})/,
    )![1];
    expect(await response.text()).not.toContain(token);
    const stored = await db.passwordReset.findUniqueOrThrow({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    });
    expect(stored.usedAt).not.toBeNull();
    expect(
      (
        await post(admin, "/api/auth/reset-password", {
          token,
          password: "blocked8",
          passwordConfirmation: "blocked8",
        })
      ).status(),
    ).toBe(400);
  } finally {
    failTelegram = false;
  }
});
