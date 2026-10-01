import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { telegramWebhookUrl } from "../lib/telegram-url";

describe("Telegram webhook destination", () => {
  it("explains missing public HTTPS rather than accepting localhost", () => {
    assert.throws(() => telegramWebhookUrl("http://localhost:3000/api/telegram/setup"), /TELEGRAM_WEBHOOK_BASE_URL/);
    assert.throws(() => telegramWebhookUrl("https://localhost/api/telegram/setup"), /localhost/);
  });
  it("uses a dedicated tunnel origin without changing the browser origin", () => {
    assert.equal(telegramWebhookUrl("http://localhost:3000/api/telegram/setup", " https://tunnel.example/ ", "http://localhost:3000"), "https://tunnel.example/api/telegram/webhook");
  });
  it("uses production APP_URL or the request origin when no override exists", () => {
    assert.equal(telegramWebhookUrl("http://internal:3000/api/telegram/setup", "", "https://clinic.example"), "https://clinic.example/api/telegram/webhook");
    assert.equal(telegramWebhookUrl("https://clinic.example/api/telegram/setup"), "https://clinic.example/api/telegram/webhook");
  });
  it("rejects malformed destinations, credentials and unsupported ports", () => {
    for (const url of ["not-a-url", "https://user:password@clinic.example", "https://clinic.example:3000"]) assert.throws(() => telegramWebhookUrl("https://clinic.example", url));
  });
});
