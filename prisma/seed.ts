import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  const phone = process.env.BOOTSTRAP_ADMIN_PHONE?.replace(/^976/, "");
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!phone || !password || password.length < 8)
    throw new Error(
      "BOOTSTRAP_ADMIN_PHONE болон 8+ тэмдэгттэй BOOTSTRAP_ADMIN_PASSWORD-ийг .env-д тохируулна уу.",
    );
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('bb-users'))::text AS locked`;
    await tx.user.upsert({
      where: { phone },
      create: {
        phone,
        name: process.env.BOOTSTRAP_ADMIN_NAME || "Админ",
        role: "ADMIN",
        email: process.env.BOOTSTRAP_ADMIN_EMAIL || undefined,
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        passwordHash: await hash(password, 12),
      },
      update: {},
    });
  });
  for (const [key, value] of Object.entries({
    clinicName: "BB Dental Clinic",
    phone: "9596-3531",
    address: "БГД, 12-р хороо, 3, 4-р хороолол",
    hours: "Даваа–Баасан 09:00–19:00, Бямба–Ням 10:00–18:00",
    reportTitle: "BB Dental Clinic тайлан",
  }))
    await db.setting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  console.log("Админ болон эмнэлгийн үндсэн тохиргоо бэлэн.");
}
main().finally(() => db.$disconnect());
