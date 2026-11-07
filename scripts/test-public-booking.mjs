// Browser regression checks with 100 services; all APIs use isolated fixtures.
// Start the local app, then run: UI_BASE_URL=http://localhost:3101 node scripts/test-public-booking.mjs
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.env.UI_BASE_URL || "http://localhost:3101";
const output = process.env.UI_QA_OUTPUT || "/private/tmp/bb-booking-qa";
await mkdir(output, { recursive: true });
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ulaanbaatar",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const doctors = [
  { id: "doctor-a", name: "Эмч А", specialty: "Ерөнхий эмчилгээ" },
  { id: "doctor-b", name: "Эмч Б", specialty: "Гажиг засал" },
];
const services = Array.from({ length: 100 }, (_, i) => ({
  id: `service-${i + 1}`,
  name: `Үйлчилгээ ${String(i + 1).padStart(3, "0")} · Шүдний үзлэг, оношилгоо`,
  category: i % 2 ? "Гажиг засал" : "Ерөнхий эмчилгээ",
  description: "Мэргэжлийн эмчийн үзлэг, зөвлөгөө, дэлгэрэнгүй оношилгоо.",
  imageUrl: i < 6 ? "/images/default-logo.png" : "",
  price: 35000 + i * 1000,
  doctorIds: [],
}));
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [375, 768, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      colorScheme: "light",
    });
    page.setDefaultTimeout(10000);
    const pageSize = width < 600 ? 4 : 6;
    const errors = [];
    let booking;
    let returningRequests = 0;
    const childBirth = `${Number(date.slice(0, 4)) - 10}-01-01`;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      let json = {};
      if (url.pathname.endsWith("/catalog"))
        json = { services, doctors, clinic: {} };
      if (url.pathname.endsWith("/calendar")) json = { dates: [date] };
      if (url.pathname.endsWith("/suggestions"))
        json = {
          suggestions: [{ doctor: doctors[0], slots: ["14:00", "15:00"] }],
        };
      if (url.pathname.endsWith("/availability"))
        json = { slots: ["14:00", "15:00"] };
      if (url.pathname.endsWith("/returning-contact")) {
        returningRequests++;
        const { phone } = route.request().postDataJSON();
        json = {
          contact:
            phone === "99112244"
              ? {
                  name: "Бүртгэлтэй Хүүхэд",
                  birthDate: childBirth,
                  gender: "FEMALE",
                  guardianName: "Асран хамгаалагч",
                  guardianPhone: "88112244",
                }
              : null,
        };
      }
      if (url.pathname.endsWith("/booking")) {
        booking = route.request().postDataJSON();
        json = { id: "booking", date, startTime: "14:00" };
      }
      await route.fulfill({ status: 200, json });
    });
    await page.goto(base);
    await expect(page.locator(".service-browser-item")).toHaveCount(pageSize);
    await expect(page.locator("#booking")).toHaveCount(0);
    await expect(page.locator(".header-book")).toHaveAttribute(
      "href",
      "/booking",
    );
    await page.locator(".service-browser-item").first().click();
    await expect(page).toHaveURL(/\/booking\?service=service-1$/);
    await expect(
      page.getByRole("heading", { name: "Эмч, өдөр, цагаа сонгох" }),
    ).toBeVisible();
    await expect(page.locator(".booking-selected-service")).toContainText(
      "Үйлчилгээ 001",
    );

    await page.goto(`${base}/booking?doctor=doctor-b`);
    await expect(page.locator(".service-browser-item")).toHaveCount(pageSize);
    await expect(page.locator(".service-browser-meta")).toContainText(
      "100 үйлчилгээ",
    );
    await page.getByRole("button", { name: "Дараах", exact: true }).click();
    await expect(page.locator(".service-browser-item").first()).toContainText(
      `Үйлчилгээ ${String(pageSize + 1).padStart(3, "0")}`,
    );
    await page
      .getByLabel("Ангилал", { exact: true })
      .selectOption("Гажиг засал");
    await expect(page.locator(".service-browser-meta")).toContainText(
      "50 үйлчилгээ",
    );
    await expect(page.locator(".service-browser-pagination")).toContainText(
      `1 / ${Math.ceil(50 / pageSize)}`,
    );
    await page.getByLabel("Үйлчилгээ хайх").fill("Үйлчилгээ 100");
    await expect(page.locator(".service-browser-item")).toHaveCount(1);
    await page.getByLabel("Үйлчилгээ хайх").fill("Олдохгүй үйлчилгээ");
    await expect(page.getByText("Тохирох үйлчилгээ олдсонгүй.")).toBeVisible();
    await page.getByRole("button", { name: "Шүүлт цэвэрлэх" }).click();
    await expect(page.locator(".service-browser-item")).toHaveCount(pageSize);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".service-browser")
        .evaluate((el) => el.getBoundingClientRect().height),
    ).toBeLessThan(width < 600 ? 1050 : 800);
    await page.screenshot({
      path: `${output}/services-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("Үйлчилгээ хайх").fill("Үйлчилгээ 100");
    await page.locator(".service-browser-item").click();
    await expect(page.locator(".public-booking-fields select")).toHaveValue(
      "doctor-b",
    );
    await page
      .getByRole("button", { name: `${date}: сул цагтай`, exact: true })
      .click();
    await page.locator(".public-time-slots button").first().click();
    await page
      .getByRole("button", { name: "Үргэлжлүүлэх", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Үгүй, анх удаа", exact: true })
      .click();
    await page.getByLabel("Утасны дугаар", { exact: true }).fill("99112233");
    await page.getByLabel("Овог, нэр", { exact: true }).fill("Тест хэрэглэгч");
    await page.getByRole("button", { name: "Захиалга илгээх" }).click();
    await expect(
      page.getByRole("heading", { name: "Таны захиалга бүртгэгдлээ" }),
    ).toBeVisible();
    expect(booking).toMatchObject({
      serviceId: "service-100",
      doctorId: "doctor-b",
      date,
      startTime: "14:00",
    });
    expect(returningRequests).toBe(0);
    await page.goto(`${base}/booking?service=service-1&doctor=doctor-a`);
    await page.locator(".public-time-slots button").first().click();
    await page
      .getByRole("button", { name: "Үргэлжлүүлэх", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Тийм, өмнө үйлчлүүлж байсан", exact: true })
      .click();
    await page.getByLabel("Утасны дугаар", { exact: true }).fill("99112244");
    await expect(page.getByLabel("Овог, нэр", { exact: true })).toHaveValue(
      "Бүртгэлтэй Хүүхэд",
    );
    await expect(page.getByLabel("Нас", { exact: true })).toHaveText(
      "10 настай",
    );
    await expect(
      page.getByLabel("Асран хамгаалагчийн нэр", { exact: true }),
    ).toHaveValue("Асран хамгаалагч");
    await expect(
      page.getByLabel("Асран хамгаалагчийн утас", { exact: true }),
    ).toHaveValue("88112244");
    await expect(page.locator(".booking-contact-form")).not.toContainText(
      "хайж байна",
    );
    await page.getByLabel("Зовиур (заавал биш)").fill("Шүд эмзэглэнэ");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${output}/confirmation-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Захиалга илгээх" }).click();
    await expect(
      page.getByRole("heading", { name: "Таны захиалга бүртгэгдлээ" }),
    ).toBeVisible();
    expect(booking).toMatchObject({
      name: "Бүртгэлтэй Хүүхэд",
      birthDate: childBirth,
      gender: "FEMALE",
      guardianPhone: "88112244",
      note: "Шүд эмзэглэнэ",
    });
    await page.goto(`${base}/booking?service=service-1&doctor=doctor-a`);
    await page.locator(".public-time-slots button").first().click();
    await page
      .getByRole("button", { name: "Үргэлжлүүлэх", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Тийм, өмнө үйлчлүүлж байсан", exact: true })
      .click();
    await page.getByLabel("Утасны дугаар", { exact: true }).fill("99119999");
    await expect(page.getByLabel("Овог, нэр", { exact: true })).toHaveValue("");
    await page
      .getByLabel("Төрсөн огноо", { exact: true })
      .fill(`${Number(date.slice(0, 4)) - 18}${date.slice(4)}`);
    await expect(page.getByLabel("Нас", { exact: true })).toHaveText(
      "18 настай",
    );
    await expect(page.locator(".booking-guardian-fields")).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      `PASS ${width}px: 100 services, ${pageSize} visible, pagination, category/search/reset, deep links, doctor preservation, new/returning booking, quiet autofill, age/guardian fields, symptoms and no overflow or browser errors.`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
