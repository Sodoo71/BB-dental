import { test, expect } from "@playwright/test";

const services = Array.from({ length: 23 }, (_, index) => ({ id: `service-${index}`, name: `Үйлчилгээ ${index}`, category: "GENERAL", durationMin: 30, price: 50000 }));
const doctors = [{ id: "doctor-1", name: "Эмч Номин", title: "Их эмч" }, { id: "doctor-2", name: "Эмч Болд", title: "Их эмч" }];
const date = new Date();
date.setDate(date.getDate() + 2);
const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/services", (route) => route.fulfill({ json: { data: services } }));
  await page.route("**/api/doctors", (route) => route.fulfill({ json: { data: doctors } }));
  await page.route("**/api/clinic", (route) => route.fulfill({ json: { data: { clinicName: "BB Dental", logoUrl: "/images/bb-dental-logo.jpg", phone: "99112233", email: "clinic@example.com", address: "Улаанбаатар", workingHoursNote: "09:00–18:00" } } }));
  await page.route("**/api/availability?*", (route) => route.fulfill({ json: { data: ["10:00", "11:00"] } }));
  await page.route("**/api/availability/suggest?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: { data: [{ date: day, formattedDate: "Ойрын өдөр", slot: "10:00", serviceId: params.get("serviceId"), doctorId: params.get("doctorId") || "doctor-1", doctorName: "Эмч Номин" }] } });
  });
  // Never create a real appointment during a UI test.
  await page.route("**/api/appointments", (route) => route.fulfill({ status: 201, json: { success: true } }));
  await page.goto("/");
});

test("service selection skips the long list and submits the selected service", async ({ page }) => {
  await expect(page.locator("#service-catalog > div")).toHaveCount(9);
  await page.getByRole("button", { name: "Үйлчилгээ 2 — цаг авах", exact: true }).click();
  const booking = page.locator("#booking");
  await expect(booking.getByText("Үйлчилгээ 2", { exact: true })).toBeVisible();
  await expect(booking.getByLabel("Эмч сонгох")).toBeVisible();
  await booking.getByRole("button", { name: /Ойрын өдөр/ }).click();
  await expect(booking.getByRole("button", { name: "Үргэлжлүүлэх" })).toBeEnabled();
  await booking.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await booking.getByLabel("Овог нэр *", { exact: true }).fill("Тест Хэрэглэгч");
  await booking.getByLabel("Утасны дугаар *", { exact: true }).fill("99112233");
  const request = page.waitForRequest((request) => request.url().endsWith("/api/appointments") && request.method() === "POST");
  await booking.getByRole("button", { name: "Захиалга баталгаажуулах", exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({ serviceId: "service-2", doctorId: "doctor-1", startTime: "10:00", appointmentDate: day });
  await expect(booking.getByText("Цаг амжилттай захиалагдлаа", { exact: true })).toBeVisible();
});

test("doctor prefill, bounded service search, and changing doctor clears the time", async ({ page }) => {
  await page.getByRole("button", { name: "Эмч Болд — цаг захиалах", exact: true }).click();
  const booking = page.locator("#booking");
  await expect(booking.getByRole("button", { name: /Үйлчилгээ \d+.*30 мин/ })).toHaveCount(6);
  await booking.getByRole("searchbox", { name: "Захиалах үйлчилгээ хайх" }).fill("Үйлчилгээ 22");
  await booking.getByRole("button", { name: /Үйлчилгээ 22/ }).click();
  await expect(booking.getByLabel("Эмч сонгох")).toHaveValue("doctor-2");
  await booking.getByRole("button", { name: /Ойрын өдөр/ }).click();
  await expect(booking.getByRole("button", { name: "Үргэлжлүүлэх" })).toBeEnabled();
  await booking.getByLabel("Эмч сонгох").selectOption("doctor-1");
  await expect(booking.getByRole("button", { name: "Үргэлжлүүлэх" })).toBeDisabled();
  await expect(booking.getByRole("button", { name: "10:00", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await booking.screenshot({ path: "/tmp/bb-booking-mobile.png" });
});

test("slot conflict keeps patient details and lets the user choose another time", async ({ page }) => {
  await page.route("**/api/appointments", (route) => route.fulfill({ status: 409, json: { error: "Энэ цаг захиалагдсан байна." } }));
  await page.getByRole("button", { name: "Үйлчилгээ 0 — цаг авах", exact: true }).click();
  const booking = page.locator("#booking");
  await booking.getByRole("button", { name: /Ойрын өдөр/ }).click();
  await booking.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await booking.getByLabel("Овог нэр *", { exact: true }).fill("Тест Нэр");
  await booking.getByLabel("Утасны дугаар *", { exact: true }).fill("99112233");
  await booking.getByRole("button", { name: "Захиалга баталгаажуулах", exact: true }).click();
  await expect(booking.getByRole("alert")).toContainText("Энэ цаг захиалагдсан байна.");
  await expect(booking.getByRole("button", { name: "Үргэлжлүүлэх" })).toBeDisabled();
  await booking.getByRole("button", { name: "11:00", exact: true }).click();
  await booking.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await expect(booking.getByLabel("Овог нэр *", { exact: true })).toHaveValue("Тест Нэр");
});

test("availability errors can be retried and the layout fits small and large screens", async ({ page }) => {
  let fail = true;
  await page.route("**/api/availability?*", (route) => route.fulfill(fail ? { status: 500, json: { error: "Цаг ачаалж чадсангүй." } } : { json: { data: ["11:00"] } }));
  await page.getByRole("button", { name: "Үйлчилгээ 0 — цаг авах", exact: true }).click();
  const booking = page.locator("#booking");
  await booking.getByRole("button", { name: /Ойрын өдөр/ }).click();
  await expect(booking.getByRole("alert")).toContainText("Цаг ачаалж чадсангүй.");
  await expect(booking.getByRole("button", { name: "Үргэлжлүүлэх" })).toBeDisabled();
  fail = false;
  await booking.getByRole("button", { name: "Дахин оролдох" }).click();
  await expect(booking.getByRole("button", { name: "11:00", exact: true })).toBeVisible();
  await expect(booking.getByRole("button", { name: "Үргэлжлүүлэх" })).toBeDisabled();
  await booking.getByRole("button", { name: "11:00", exact: true }).click();
  await expect(booking.getByRole("button", { name: "Үргэлжлүүлэх" })).toBeEnabled();
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
});
