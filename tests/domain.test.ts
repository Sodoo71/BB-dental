import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateSchema,
  normalizePhone,
  overlaps,
  periodRange,
  phoneSchema,
  today,
} from "../lib/domain";
import {
  paymentSchema,
  scheduleSchema,
  treatmentSchema,
} from "../lib/validation";
const id = "11111111-1111-4111-8111-111111111111";
test("Mongolian phone normalization and invalid numbers", () => {
  assert.equal(normalizePhone("+976 9911-2233"), "99112233");
  assert.equal(phoneSchema.parse("+976 9911-2233"), "99112233");
  assert.equal(phoneSchema.safeParse("12345678").success, false);
});
test("overlaps include containment and exclude adjacent slots", () => {
  assert.equal(overlaps("09:00", "10:00", "09:30", "10:30"), true);
  assert.equal(overlaps("09:00", "10:00", "09:15", "09:30"), true);
  assert.equal(overlaps("09:00", "10:00", "10:00", "11:00"), false);
});
test("calendar validates actual dates and leap years", () => {
  assert.equal(dateSchema.safeParse("2026-02-30").success, false);
  assert.equal(dateSchema.safeParse("2028-02-29").success, true);
  assert.equal(dateSchema.safeParse("2026-13-01").success, false);
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
});
test("report month boundaries handle December rollover", () => {
  assert.deepEqual(periodRange("month", "2026", "12"), {
    gte: "2026-12-01",
    lt: "2027-01-01",
  });
  assert.deepEqual(periodRange("year", "2026", "01"), {
    gte: "2026-01-01",
    lt: "2027-01-01",
  });
  assert.deepEqual(periodRange("all", null, null), {});
  assert.throws(() => periodRange("month", "2026", "13"));
});
test("cashier rejects negative, zero and fractional amounts", () => {
  const data = {
    patientId: id,
    amount: 10000,
    method: "CASH",
    date: "2026-11-06",
    idempotencyKey: id,
  };
  assert.equal(paymentSchema.safeParse(data).success, true);
  for (const amount of [-1, 0, 1.5, 1e12])
    assert.equal(paymentSchema.safeParse({ ...data, amount }).success, false);
});
test("invalid working ranges and FDI numbers are rejected", () => {
  assert.equal(
    scheduleSchema.safeParse({
      doctorId: id,
      weekday: 1,
      startTime: "18:00",
      endTime: "09:00",
    }).success,
    false,
  );
  const t = {
    patientId: id,
    doctorId: id,
    serviceId: id,
    date: "2026-11-06",
    diagnosis: "test",
    procedure: "test",
    amount: 0,
  };
  assert.equal(treatmentSchema.safeParse({ ...t, tooth: 19 }).success, false);
  assert.equal(treatmentSchema.safeParse({ ...t, tooth: 55 }).success, true);
});

test("registration requires matching eight-character passwords, email and numeric optional Telegram ID", async () => {
  const { registrationSchema, passwordSchema } =
    await import("../lib/validation");
  const data = {
    name: "Эмч Тест",
    email: "Doctor@Example.com",
    phone: "99112233",
    telegramChatId: "12345678",
    password: "12345678",
    passwordConfirmation: "12345678",
  };
  assert.equal(registrationSchema.parse(data).email, "doctor@example.com");
  assert.equal(
    registrationSchema.safeParse({ ...data, telegramChatId: "" }).success,
    true,
  );
  assert.equal(
    registrationSchema.safeParse({
      ...data,
      password: "1234567",
      passwordConfirmation: "1234567",
    }).success,
    false,
  );
  assert.equal(
    registrationSchema.safeParse({ ...data, passwordConfirmation: "abcdefgh" })
      .success,
    false,
  );
  assert.equal(
    registrationSchema.safeParse({ ...data, email: "invalid" }).success,
    false,
  );
  assert.equal(
    registrationSchema.safeParse({ ...data, telegramChatId: "@doctor" })
      .success,
    false,
  );
  assert.equal(passwordSchema.safeParse("ө".repeat(40)).success, false);
});

test("Telegram delivery targets the registered chat and reports API rejection", async () => {
  const { notifyDoctor } = await import("../lib/booking");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = "qa-test-token";
  try {
    let calls = 0;
    const fake: typeof fetch = async (input, init) => {
      calls++;
      assert.equal(
        String(input),
        "https://api.telegram.org/botqa-test-token/sendMessage",
      );
      const data = JSON.parse(String(init?.body));
      assert.equal(data.chat_id, "12345678");
      assert.equal(data.text, "Шинэ цаг: 2026-11-08 09:00");
      return Response.json({ ok: true, result: { message_id: 1 } });
    };
    assert.equal(
      (await notifyDoctor("12345678", "Шинэ цаг: 2026-11-08 09:00", fake)).ok,
      true,
    );
    assert.equal(
      (await notifyDoctor("", "No recipient", fake)).code,
      "NOT_CONFIGURED",
    );
    assert.equal(calls, 1);
    const rejected: typeof fetch = async () =>
      Response.json({ ok: false }, { status: 400 });
    assert.equal(
      (await notifyDoctor("12345678", "test", rejected)).code,
      "FAILED",
    );
  } finally {
    if (token === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = token;
  }
});

test("Telegram recovery links use the saved private chat and validate APP_URL", async () => {
  const { sendTelegramReset, resetLink } =
    await import("../lib/reset-delivery");
  const oldToken = process.env.TELEGRAM_BOT_TOKEN,
    oldUrl = process.env.APP_URL;
  process.env.TELEGRAM_BOT_TOKEN = "qa-test-token";
  process.env.APP_URL = "https://clinic.example.com";
  try {
    let calls = 0;
    const fake: typeof fetch = async (_input, init) => {
      calls++;
      const message = JSON.parse(String(init?.body));
      assert.equal(message.chat_id, "12345678");
      assert.match(
        message.text,
        /https:\/\/clinic\.example\.com\/reset-password\?token=abc123/,
      );
      return Response.json({ ok: true });
    };
    await sendTelegramReset("12345678", "Тест", "abc123", fake);
    assert.equal(calls, 1);
    await assert.rejects(
      sendTelegramReset("-12345678", "Тест", "abc123", fake),
    );
    assert.equal(calls, 1);
    process.env.APP_URL = "file:///private/tmp";
    assert.throws(() => resetLink("abc"));
  } finally {
    if (oldToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = oldToken;
    if (oldUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = oldUrl;
  }
});

test("Telegram webhook installation requires a public HTTPS base URL", async () => {
  const { webhookUrl, sealToken } = await import("../lib/telegram");
  const oldUrl = process.env.APP_URL,
    oldKey = process.env.SETTINGS_ENCRYPTION_KEY;
  try {
    process.env.APP_URL = "http://localhost:3000";
    assert.throws(() => webhookUrl());
    process.env.APP_URL = "https://clinic.example.com";
    assert.equal(
      webhookUrl(),
      "https://clinic.example.com/api/telegram/webhook",
    );
    process.env.SETTINGS_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const first = sealToken("test-secret-token"),
      second = sealToken("test-secret-token");
    assert.notEqual(first, second);
    assert.equal(first.includes("test-secret-token"), false);
  } finally {
    if (oldUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
    else process.env.SETTINGS_ENCRYPTION_KEY = oldKey;
  }
});
