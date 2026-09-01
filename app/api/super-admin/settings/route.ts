import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const getRealDefaultSettings = (): Record<string, Record<string, unknown>> => ({
  clinic_info: {
    clinicName: "BB Dental Clinic",
    phone: "+976 9596-3531",
    email: process.env.SUPER_ADMIN_EMAIL || "sodoosodbileg71@gmail.com",
    address:
      "БГД, 12-р хороо, 3, 4-р хороолол, Бичлийн аркны автобусны буудал дээр, Азифармтай эмийн сангийн 3 давхарт, BB Dental Clinic",
    workingHoursNote:
      "Даваа - Баасан: 09:00 - 19:00 | Бямба - Ням: 10:00 - 18:00",
  },
  telegram_config: {
    botToken:
      process.env.TELEGRAM_BOT_TOKEN ||
      "8758601589:AAFqJ_IWnBcy8lCw9Vs-iq2ZJsX9NmUZilo",
    channelId: process.env.ADMIN_CHAT_ID || "8411351733",
    enabled: true,
  },
  registration_policy: {
    autoApproveDoctors: false,
    defaultDuration: "30",
  },
  security_config: {
    maintenanceMode: false,
    allowPublicBooking: true,
    requireStrongPassword: true,
  },
});

export async function GET() {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Хандах эрхгүй байна." }, { status: 403 });
  }

  const defaultSettings = getRealDefaultSettings();

  try {
    let rows: Array<{ key: string; value: string }> = [];
    try {
      rows = await prisma.systemSetting.findMany();
    } catch {
      try {
        rows = await prisma.$queryRawUnsafe<Array<{ key: string; value: string }>>(
          `SELECT "key", "value" FROM "SystemSetting"`
        );
      } catch {
        rows = [];
      }
    }

    const result: Record<string, Record<string, unknown>> = { ...defaultSettings };

    for (const row of rows) {
      try {
        result[row.key] = {
          ...(defaultSettings[row.key] || {}),
          ...JSON.parse(row.value),
        };
      } catch {
        // use default
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET /api/super-admin/settings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Тохиргоо ачаалахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Хандах эрхгүй байна." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const section = typeof body.section === "string" ? body.section.trim() : "";
    const data = body.data && typeof body.data === "object" ? body.data : null;

    if (!section || !data) {
      return NextResponse.json(
        { error: "Тохиргооны хэсэг болон өгөгдөл шаардлагатай." },
        { status: 400 },
      );
    }

    const valueStr = JSON.stringify(data);

    try {
      const saved = await prisma.systemSetting.upsert({
        where: { key: section },
        create: { key: section, value: valueStr },
        update: { value: valueStr },
      });

      return NextResponse.json({
        success: true,
        data: JSON.parse(saved.value),
        message: "Тохиргоо амжилттай хадгалагдлаа.",
      });
    } catch (upsertErr) {
      console.warn("Prisma upsert warning, trying raw SQL query:", upsertErr);
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
         VALUES ($1, $2, NOW())
         ON CONFLICT ("key") DO UPDATE SET "value" = $2, "updatedAt" = NOW()`,
        section,
        valueStr,
      );

      return NextResponse.json({
        success: true,
        data,
        message: "Тохиргоо амжилттай хадгалагдлаа.",
      });
    }
  } catch (error) {
    console.error("POST /api/super-admin/settings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Тохиргоо хадгалахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}
