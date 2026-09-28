import { doctorProfileSchema } from "@/lib/validation/doctor";
import { apiError } from "@/lib/security/http";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const user = await requireRole("DOCTOR");
  if (!user || !user.doctorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: user.doctorId },
    select: {
      id: true,
      name: true,
      title: true,
      phone: true,
      email: true,
      telegramChatId: true,
      avatarUrl: true,
      imageUrl: true,
      isActive: true,
    },
  });

  if (!doctor) {
    return NextResponse.json(
      { error: "Doctor profile not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: doctor });
}

export async function PUT(request: Request) {
  const user = await requireRole("DOCTOR");
  if (!user || !user.doctorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const input = doctorProfileSchema.pick({ name: true, title: true, phone: true, email: true, avatarUrl: true, telegramChatId: true }).parse(await request.json());
    const doctor = await prisma.$transaction(async tx => {
      const account = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      const email = input.email || account.email;
      await tx.user.update({ where: { id: user.id }, data: { name: input.name, phone: input.phone, email, avatarUrl: input.avatarUrl, telegramChatId: input.telegramChatId } });
      const profile = await tx.doctor.update({ where: { id: user.doctorId! }, data: { ...input, email, imageUrl: input.avatarUrl } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "DOCTOR_PROFILE_UPDATED", entity: "Doctor", entityId: profile.id } });
      return profile;
    });

    return NextResponse.json({ success: true, data: doctor });
  } catch (error) { return apiError(error); }
}
