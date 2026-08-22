import { NextResponse } from "next/server";
import { AppointmentStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// Захиалгын статус шинэчлэх (PATCH)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }, // 2. Promise болгож төрлийг нь засав
) {
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  try {
    const { id } = await params; // params-ийг await хийнэ
    const { status }: { status?: unknown } = await req.json();
    if (
      !Object.values(AppointmentStatus).includes(status as AppointmentStatus)
    ) {
      return NextResponse.json(
        { error: "Захиалгын төлөв буруу байна." },
        { status: 400 },
      );
    }
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!appointment) {
      return NextResponse.json(
        { error: "Захиалга олдсонгүй." },
        { status: 404 },
      );
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: status as AppointmentStatus },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error("PATCH Error:", error);
    return NextResponse.json(
      {
        error: "Шинэчлэхэд алдаа гарлаа",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// Захиалга устгах (DELETE)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }, // 2. Promise болгож төрлийг нь засав
) {
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  try {
    const { id } = await params; // params-ийг await хийнэ
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!appointment) {
      return NextResponse.json(
        { error: "Захиалга олдсонгүй." },
        { status: 404 },
      );
    }

    await prisma.appointment.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Амжилттай устгагдлаа",
    });
  } catch (error: unknown) {
    console.error("DELETE Error:", error);
    return NextResponse.json(
      {
        error: "Устгахад алдаа гарлаа",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
