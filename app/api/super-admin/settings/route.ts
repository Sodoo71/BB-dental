import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { apiError, HttpError } from "@/lib/security/http";
const schemas = {
  clinic_info: z.object({ clinicName: z.string().trim().min(1).max(120), phone: z.string().max(40), email: z.union([z.literal(""), z.string().email()]), address: z.string().max(1000), workingHoursNote: z.string().max(1000) }),
  telegram_config: z.object({ channelId: z.string().max(100).default(""), enabled: z.boolean() }),
  registration_policy: z.object({ autoApproveDoctors: z.boolean(), defaultDuration: z.string().regex(/^\d{1,3}$/).default("30") }),
  security_config: z.object({ maintenanceMode: z.boolean(), allowPublicBooking: z.boolean(), requireStrongPassword: z.literal(true), sessionTimeoutHours: z.literal("12"), maxFailedLogins: z.literal("8") }),
};
const defaults = () => ({
  clinic_info: { clinicName: "BB Dental Clinic", phone: "", email: "", address: "", workingHoursNote: "" },
  telegram_config: { channelId: process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_CHAT_ID || "", enabled: true },
  registration_policy: { autoApproveDoctors: false, defaultDuration: "30" },
  security_config: { maintenanceMode: false, allowPublicBooking: true, requireStrongPassword: true, sessionTimeoutHours: "12", maxFailedLogins: "8" },
});
export async function GET() {
  try {
    if (!await requirePermission("settings:manage")) throw new HttpError(403, "Хандах эрхгүй байна.");
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: Object.keys(schemas) } } });
    const result: Record<string, unknown> = defaults();
    for (const row of rows) {
      const key = row.key as keyof typeof schemas;
      try {
        const parsed = schemas[key].safeParse(JSON.parse(row.value));
        if (parsed.success) result[key] = parsed.data;
      } catch { /* Invalid legacy settings use safe defaults. */ }
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await requirePermission("settings:manage");
    if (!actor) throw new HttpError(403, "Хандах эрхгүй байна.");
    const body = z.object({ section: z.enum(["clinic_info", "telegram_config", "registration_policy", "security_config"]), data: z.unknown() }).parse(await request.json());
    const data = schemas[body.section].parse(body.data);
    if (body.section === "security_config") throw new HttpError(400, "Security policy is currently managed by the server. These controls are read-only.");
    await prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({ where: { key: body.section }, create: { key: body.section, value: JSON.stringify(data) }, update: { value: JSON.stringify(data) } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "SETTINGS_UPDATED", entity: "SystemSetting", entityId: body.section } });
    });
    return NextResponse.json({ success: true, data, message: "Тохиргоо амжилттай хадгалагдлаа." });
  } catch (error) { return apiError(error); }
}
