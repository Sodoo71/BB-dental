import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

function normalizeText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const name = normalizeText(body.name);
    const title = normalizeText(body.title);
    const phone = normalizeText(body.phone);
    const email = normalizeText(body.email);
    const telegramChatId = normalizeText(
      body.telegramChatId ?? body.telegramId,
    );

    const updates: Record<string, string | null> = {};
    if (typeof name === "string") updates.name = name;
    if (title !== undefined) updates.title = title;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (telegramChatId !== undefined) updates.telegramChatId = telegramChatId;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No profile data to update." },
        { status: 400 },
      );
    }

    const doctor = await prisma.doctor.update({
      where: { id: user.doctorId },
      data: updates,
    });

    if (typeof email === "string" && email.length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { email },
      });
    }

    return NextResponse.json({ success: true, data: doctor });
  } catch (error) {
    console.error("PUT /api/doctor/profile error:", error);

    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "И-мэйл аль хэдийн бүртгэлтэй байна." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Профайлаа шинэчлэхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}
