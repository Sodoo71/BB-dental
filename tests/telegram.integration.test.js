import { afterAll, beforeEach, expect, mock, test } from "bun:test";

let config = { enabled: true, channelId: "5678" };
let status = "PENDING";
let writes = 0;
let audits = 0;
const calls = [];
let doctorDelivery = true;
const originalFetch = globalThis.fetch;
const originalToken = process.env.TELEGRAM_BOT_TOKEN;
const originalSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const database = {
  systemSetting: { findUnique: async () => ({ value: JSON.stringify(config) }) },
  appointment: {
    findUnique: async () => ({ id: "appointment-1", doctorId: "doctor-1", status, doctor: { telegramChatId: "1234", isActive: true, user: { id: "user-1", role: "DOCTOR", status: "ACTIVE", isActive: true } } }),
    updateMany: async ({ where, data }) => { if (where.status !== status) return { count: 0 }; status = data.status; writes++; return { count: 1 }; },
  },
  auditLog: { create: async () => { audits++; } },
  $transaction: async (operation) => operation(database),
};
mock.module("../lib/prisma", () => ({ prisma: database }));
const { notifyDoctorOnTelegram } = await import("../lib/telegram");
const { POST } = await import("../app/api/telegram/webhook/route");

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret";
  status = "PENDING"; writes = 0; audits = 0; calls.length = 0; doctorDelivery = true;
  config = { enabled: true, channelId: "5678" };
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ method: String(url).split("/").at(-1), body });
    return Response.json({ ok: body.chat_id === "1234" ? doctorDelivery : true });
  };
});
afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  if (originalSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET; else process.env.TELEGRAM_WEBHOOK_SECRET = originalSecret;
  mock.restore();
});
const notification = { chatId: "1234", appointmentId: "appointment-1", doctorName: "Эмч_Нэр", patientName: "Нэр [тест]", patientPhone: "99112233", serviceName: "Үзлэг *", appointmentDate: new Date("2026-10-02T00:00:00Z"), startTime: "10:00", chiefComplaint: "[special]_`" };
function callback(data, sender = 1234, secret = "test-secret") {
  return new Request("https://clinic.example/api/telegram/webhook", { method: "POST", headers: { "x-telegram-bot-api-secret-token": secret, "Content-Type": "application/json" }, body: JSON.stringify({ callback_query: { id: "callback-1", data, from: { id: sender }, message: { message_id: 1, chat: { id: 1234, type: "private" }, text: "Нэр [тест]_`" } } }) });
}
test("notification targets the assigned doctor with buttons and safely preserves special characters", async () => {
  expect(await notifyDoctorOnTelegram(notification)).toBe(true);
  expect(calls[0].body.chat_id).toBe("1234");
  expect(calls[0].body.parse_mode).toBeUndefined();
  expect(calls[0].body.text).toContain("[special]_`");
  expect(calls[0].body.reply_markup.inline_keyboard[0][0].callback_data).toBe("confirm:appointment-1");
  expect(calls[1].body.chat_id).toBe("5678");
  expect(calls[1].body.reply_markup).toBeUndefined();
});
test("a successful admin channel copy does not mask failed doctor delivery", async () => {
  doctorDelivery = false;
  expect(await notifyDoctorOnTelegram(notification)).toBe(false);
});
test("disabled notifications do not send messages", async () => {
  config.enabled = false;
  expect(await notifyDoctorOnTelegram(notification)).toBe(false);
  expect(calls).toHaveLength(0);
});
test("confirm then cancel updates once, audits the changes and removes stale buttons", async () => {
  expect((await POST(callback("confirm:appointment-1"))).status).toBe(200);
  expect(status).toBe("CONFIRMED");
  expect(calls.find((call) => call.method === "editMessageText").body.reply_markup.inline_keyboard[0][0].callback_data).toBe("cancel:appointment-1");
  await POST(callback("confirm:appointment-1"));
  expect(writes).toBe(1);
  await POST(callback("cancel:appointment-1"));
  expect(status).toBe("CANCELLED");
  expect(writes).toBe(2); expect(audits).toBe(2);
  expect(calls.filter((call) => call.method === "editMessageText").at(-1).body.reply_markup.inline_keyboard).toEqual([]);
  await POST(callback("confirm:appointment-1"));
  expect(status).toBe("CANCELLED"); expect(writes).toBe(2);
});
test("wrong sender gets an explanation and cannot change the appointment", async () => {
  expect((await POST(callback("cancel:appointment-1", 9999))).status).toBe(200);
  expect(writes).toBe(0);
  expect(calls[0].method).toBe("answerCallbackQuery");
});
test("invalid webhook secret is rejected before any action", async () => {
  expect((await POST(callback("cancel:appointment-1", 1234, "wrong"))).status).toBe(401);
  expect(writes).toBe(0); expect(calls).toHaveLength(0);
});
