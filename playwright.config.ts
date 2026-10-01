import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000", viewport: { width: 390, height: 844 }, reducedMotion: "reduce" },
});
