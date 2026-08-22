import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { parseDateInput } from "@/lib/availability";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: doctorId } = await context.params;
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { id: true },
  });
  if (!doctor)
    return NextResponse.json({ error: "Эмч олдсонгүй." }, { status: 404 });

  const items = await prisma.doctorAvailabilityException.findMany({
    where: { doctorId },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ success: true, data: items });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: doctorId } = await context.params;
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const dateValue = typeof body.date === "string" ? body.date : "";
    const type = typeof body.type === "string" ? body.type : "BLOCKED_RANGE";
    const startTime = typeof body.startTime === "string" ? body.startTime : "";
    const endTime = typeof body.endTime === "string" ? body.endTime : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const date = parseDateInput(dateValue);

    if (!date)
      return NextResponse.json(
        { error: "Өдрийн формат буруу байна." },
        { status: 400 },
      );
    const validTypes = [
      "DAY_OFF",
      "BLOCKED_RANGE",
      "SCHEDULE_OVERRIDE",
    ] as const;
    const availabilityType = type as (typeof validTypes)[number];
    if (!validTypes.includes(availabilityType)) {
      return NextResponse.json(
        { error: "Төрөл буруу байна." },
        { status: 400 },
      );
    }

    if (type === "DAY_OFF") {
      const item = await prisma.doctorAvailabilityException.create({
        data: {
          doctorId,
          date,
          type: "DAY_OFF",
          reason: reason || "Day off",
        },
      });
      return NextResponse.json({ success: true, data: item }, { status: 201 });
    }

    if (type === "SCHEDULE_OVERRIDE") {
      if (
        !timePattern.test(startTime) ||
        !timePattern.test(endTime) ||
        startTime >= endTime
      ) {
        return NextResponse.json(
          { error: "Өдөр/цагийн хязгаарыг зөв оруулна уу." },
          { status: 400 },
        );
      }
      const item = await prisma.doctorAvailabilityException.create({
        data: {
          doctorId,
          date,
          type: "SCHEDULE_OVERRIDE",
          startTime,
          endTime,
          reason: reason || "Specific schedule override",
        },
      });
      return NextResponse.json({ success: true, data: item }, { status: 201 });
    }

    if (
      !timePattern.test(startTime) ||
      !timePattern.test(endTime) ||
      startTime >= endTime
    ) {
      return NextResponse.json(
        { error: "Блоклох цагийн хязгаарыг зөв оруулна уу." },
        { status: 400 },
      );
    }

    const item = await prisma.doctorAvailabilityException.create({
      data: {
        doctorId,
        date,
        type: "BLOCKED_RANGE",
        startTime,
        endTime,
        reason: reason || "Blocked time",
      },
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/doctors/[id]/availability error:", error);
    return NextResponse.json(
      { error: "Тусгай цагийг хадгалахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: doctorId } = await context.params;
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const body = (await _request.json()) as Record<string, unknown>;
    const availabilityId = typeof body.id === "string" ? body.id : "";
    if (!availabilityId)
      return NextResponse.json(
        { error: "Хасах ID шаардлагатай." },
        { status: 400 },
      );

    await prisma.doctorAvailabilityException.deleteMany({
      where: { id: availabilityId, doctorId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/doctors/[id]/availability error:", error);
    return NextResponse.json(
      { error: "Тусгай цагийг устгахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}
