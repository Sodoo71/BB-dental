import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canActOnTelegramAppointment, parseTelegramAction, telegramStatusTransition } from "../lib/telegram-callback";
import { doctorProfileSchema } from "../lib/validation/doctor";

describe("Telegram appointment controls", () => {
  it("accepts only bounded confirm/cancel actions", () => {
    assert.deepEqual(parseTelegramAction("confirm:appointment-1"), { appointmentId: "appointment-1", status: "CONFIRMED" });
    for (const data of [null, "confirm:", "delete:one", "cancel:a:b", `confirm:${"x".repeat(51)}`]) assert.equal(parseTelegramAction(data), null);
  });
  it("requires the assigned active doctor's own private chat", () => {
    const allowed = { senderId: 1234, chatId: 1234, chatType: "private", telegramChatId: "1234", doctorActive: true, accountActive: true };
    assert.equal(canActOnTelegramAppointment(allowed), true);
    for (const override of [{ senderId: 999 }, { chatId: -1234 }, { chatType: "group" }, { doctorActive: false }, { accountActive: false }, { telegramChatId: null }]) assert.equal(canActOnTelegramAppointment({ ...allowed, ...override }), false);
  });
  it("does not reopen cancelled or completed visits on repeated callbacks", () => {
    assert.equal(telegramStatusTransition("PENDING", "CONFIRMED"), true);
    assert.equal(telegramStatusTransition("CONFIRMED", "CANCELLED"), true);
    assert.equal(telegramStatusTransition("CONFIRMED", "CONFIRMED"), false);
    for (const status of ["COMPLETED", "CANCELLED", "NO_SHOW"] as const) {
      assert.equal(telegramStatusTransition(status, "CONFIRMED"), false);
      assert.equal(telegramStatusTransition(status, "CANCELLED"), false);
    }
  });
  it("accepts personal chat IDs and rejects groups and usernames", () => {
    const schema = doctorProfileSchema.pick({ telegramChatId: true });
    assert.equal(schema.parse({ telegramChatId: " 1234 " }).telegramChatId, "1234");
    assert.equal(schema.parse({ telegramChatId: "" }).telegramChatId, null);
    for (const telegramChatId of ["-1001234", "@doctor", "0"]) assert.equal(schema.safeParse({ telegramChatId }).success, false);
  });
});
