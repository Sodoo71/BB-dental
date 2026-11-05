import { doctorProfileSchema } from "@/lib/validation/doctor";
import { apiError, HttpError } from "@/lib/security/http";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const profileSelect = { id: true, name: true, title: true, phone: true, email: true, telegramChatId: true, avatarUrl: true, imageUrl: true, isActive: true } as const;
const inputSchema = doctorProfileSchema.pick({ name: true, title: true, phone: true, email: true, avatarUrl: true, telegramChatId: true }).partial();

export async function GET() {
  try {
    const user = await requireRole("DOCTOR");
    if (!user?.doctorId) throw new HttpError(403, "Unauthorized");
    const doctor = await prisma.doctor.findUnique({ where: { id: user.doctorId }, select: profileSelect });
    if (!doctor) throw new HttpError(404, "Doctor profile not found.");
    return NextResponse.json({ success: true, data: doctor });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireRole("DOCTOR");
    if (!user?.doctorId) throw new HttpError(403, "Unauthorized");
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Хүсэлтийн мэдээлэл буруу байна.");
    // The older /doctors/profile contract also accepted telegramId.
    const input = inputSchema.parse({ ...body, ...(body.telegramId !== undefined && body.telegramChatId === undefined ? { telegramChatId: body.telegramId } : {}) });
    if (!Object.keys(input).length) throw new HttpError(400, "Өөрчлөх мэдээллээ оруулна уу.");
    const doctor = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const account = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (!account.isActive || account.status !== "ACTIVE" || account.doctorId !== user.doctorId) throw new HttpError(403, "Хандах эрх өөрчлөгдсөн байна.");
      const email = input.email || account.email;
      await tx.user.update({ where: { id: user.id }, data: { name: input.name, phone: input.phone, email, avatarUrl: input.avatarUrl, telegramChatId: input.telegramChatId } });
      const profile = await tx.doctor.update({ where: { id: user.doctorId! }, data: { ...input, email, ...(input.avatarUrl !== undefined ? { imageUrl: input.avatarUrl } : {}) }, select: profileSelect });
      if (email !== account.email) await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "DOCTOR_PROFILE_UPDATED", entity: "Doctor", entityId: profile.id, metadata: { fields: Object.keys(input) } } });
      return profile;
    });
    return NextResponse.json({ success: true, data: doctor });
  } catch (error) { return apiError(error); }
}
