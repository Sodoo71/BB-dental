import "dotenv/config";
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
const base = "http://localhost:3100";
let server: ReturnType<typeof spawn> | undefined;
if (process.argv.includes("--serve")) {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], { env: { ...process.env, APP_URL: "http://localhost:3100" }, stdio: "ignore" });
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base + "/login")).ok) break; } catch { /* wait for local server */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors: string[] = [];
const widths = process.argv.includes("--tablet-only") ? [768] : [390, 1440];
page.on("pageerror", (error) => errors.push(error.name));
await mkdir("artifacts/ui", { recursive: true });
try {
  for (const width of process.argv.includes("--staff-only") ? [] : widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/login", "/register", "/unauthorized", "/page-that-does-not-exist"]) {
      await page.goto(base + route);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      console.info(JSON.stringify({ route, width, overflow }));
      if (overflow) process.exitCode = 1;
      if (["/", "/login", "/register"].includes(route)) await page.screenshot({ path: `artifacts/ui/${route.replaceAll("/", "") || "home"}-${width}.png`, fullPage: false });
    }
  }
  if (process.argv.includes("--staff") && process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD) {
    await page.goto(base + "/login");
    await page.locator('input[type="email"]').fill(process.env.SUPER_ADMIN_EMAIL);
    await page.locator('input[autocomplete="current-password"]').fill(process.env.SUPER_ADMIN_PASSWORD);
    const loginResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
    const response = await loginResponse;
    console.info(`Staff login status: ${response.status()}`);
    if (response.ok()) {
      await page.waitForURL("**/super-admin");
      const profile = await page.evaluate(async () => (await fetch("/api/auth/me")).json());
      const routes = ["/super-admin", "/super-admin/services", "/super-admin/doctors", "/super-admin/users", "/super-admin/admins", "/super-admin/logs", "/super-admin/settings", "/admin"];
      if (profile.data.doctorId) routes.push("/doctor", "/doctor/calendar", "/doctor/appointments", "/doctor/availability", "/doctor/exceptions", "/doctor/patients", "/doctor/profile");
      else console.info("Doctor routes skipped: this account has no linked doctor profile.");
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of routes) {
          await page.goto(base + route);
          await page.waitForLoadState("networkidle");
          const overflow = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth + 1, offenders: [...document.querySelectorAll("main *")].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 10 && !el.closest(".table-scroll, dialog")).slice(0, 4).map((el) => ({ tag: el.tagName, class: el.className })) }));
          console.info(JSON.stringify({ route, width, ...overflow }));
          if (overflow.overflow) process.exitCode = 1;
          if (["/super-admin", "/admin"].includes(route)) await page.screenshot({ path: `artifacts/ui/${route.replaceAll("/", "")}-${width}.png`, fullPage: false });
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base + "/super-admin/users");
      await page.getByRole("button", { name: "Open sidebar" }).click();
      const drawer = page.getByRole("dialog", { name: "Админы цэс" });
      await drawer.waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await drawer.waitFor({ state: "hidden" });
      console.info("Mobile drawer opens and closes with Escape.");
      for (const modal of [
        { route: "/super-admin/users", trigger: "Шинэ хэрэглэгч нэмэх", label: "Ажилтны мэдээлэл" },
        { route: "/super-admin/services", trigger: "Шинэ үйлчилгээ нэмэх", label: "Үйлчилгээний мэдээлэл" },
        { route: "/super-admin/doctors", trigger: "Шинэ эмч бүртгэх", label: "Эмчийн мэдээлэл" },
      ]) {
        await page.goto(base + modal.route);
        await page.waitForLoadState("networkidle");
        const trigger = page.getByRole("button", { name: modal.trigger, exact: true });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: modal.label });
        await dialog.waitFor({ state: "visible" });
        for (let index = 0; index < 20; index++) {
          await page.keyboard.press("Tab");
          if (!await dialog.evaluate((element) => element.contains(document.activeElement))) throw new Error("Focus escaped dialog");
        }
        const bounds = await dialog.boundingBox();
        if (!bounds || bounds.x < 0 || bounds.width > 390 || bounds.height > 844) throw new Error("Dialog outside mobile viewport");
        await page.screenshot({ path: `artifacts/ui/modal-${modal.route.split("/").pop()}-390.png` });
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        if (!await trigger.evaluate((element) => element === document.activeElement)) throw new Error("Dialog did not restore focus");
        console.info(`PASS mobile dialog focus, sizing and Escape: ${modal.route}`);
      }
      await page.evaluate(async () => { await fetch("/api/auth/logout", { method: "POST" }); });
    }
  }
  console.info(JSON.stringify({ browserErrors: errors }));
  if (errors.length) process.exitCode = 1;
} finally {
  await page.evaluate(async () => { await fetch("/api/auth/logout", { method: "POST" }); }).catch(() => {});
  await browser.close(); server?.kill();
}
