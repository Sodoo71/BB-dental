import { pathToFileURL } from "node:url";
import path from "node:path";
import { defineConfig } from "@playwright/test";
const database = process.env.ERP_TEST_DATABASE_URL;
if (
  !database ||
  !/^postgres(?:ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1):\d+\/[^?]*_test(?:\?|$)/.test(
    database,
  )
)
  throw new Error(
    "ERP_TEST_DATABASE_URL must point to a separate localhost database ending in _test.",
  );
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3100",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bunx next start --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      DATABASE_URL: database,
      DIRECT_URL: database,
      APP_URL: "https://clinic.example.test",
      TELEGRAM_BOT_TOKEN: "qa-local-only",
      SETTINGS_ENCRYPTION_KEY:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      ERP_TEST_TELEGRAM_MOCK: "1",
      ERP_TEST_CLOUDINARY_MOCK: "1",
      CLOUDINARY_URL: "",
      CLOUDINARY_CLOUD_NAME: "qa-cloud",
      CLOUDINARY_API_KEY: "12345",
      CLOUDINARY_API_SECRET: "qa-cloud-secret",
      NODE_OPTIONS:
        `${process.env.NODE_OPTIONS || ""} --import=${pathToFileURL(path.resolve("e2e/telegram-preload.mjs")).href}`.trim(),
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "35359",
      SMTP_USER: "",
      SMTP_PASSWORD: "",
      SMTP_FROM: "qa@example.com",
    },
  },
  reporter: "list",
});
