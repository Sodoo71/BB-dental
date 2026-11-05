// Test-server-only transport. No request from these tests reaches real Telegram.
if (process.env.ERP_TEST_TELEGRAM_MOCK === "1") {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    if (url.hostname === "api.telegram.org") {
      const match = url.pathname.match(
        /^\/bot(?:qa-local-only|123456:qa_database_token_12345678901234567890)\/(sendMessage|getMe|getWebhookInfo|setWebhook|deleteWebhook|answerCallbackQuery|editMessageReplyMarkup)$/,
      );
      if (!match) throw new Error("Live Telegram is disabled in ERP tests");
      return originalFetch(`http://127.0.0.1:35360/telegram/${match[1]}`, init);
    }
    return originalFetch(input, init);
  };
}

if (process.env.ERP_TEST_CLOUDINARY_MOCK === "1") {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    if (url.hostname === "api.cloudinary.com") {
      if (url.pathname !== "/v1_1/qa-cloud/image/upload")
        throw new Error("Live Cloudinary uploads are disabled in ERP tests");
      return previousFetch("http://127.0.0.1:35361/upload", init);
    }
    if (url.hostname === "res.cloudinary.com") {
      if (!url.pathname.startsWith("/qa-cloud/image/upload/"))
        throw new Error("Live Cloudinary delivery is disabled in ERP tests");
      return previousFetch("http://127.0.0.1:35361/asset", init);
    }
    return previousFetch(input, init);
  };
}
