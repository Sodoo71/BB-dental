import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { clinicDateKey } from "@/lib/doctor-workspace";
import { apiError, HttpError } from "@/lib/security/http";
import { parseDateInput } from "@/lib/availability";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function GET() {
  const user = await requireRole("DOCTOR");
  if (!user || !user.doctorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const items = await prisma.doctorAvailabilityException.findMany({
    where: { doctorId: user.doctorId },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({
    success: true,
    data: items.map((item) => ({
      ...item,
      status: item.isActive ? "APPROVED" : "PENDING",
    })),
  });
}

export async function POST(request: Request) {
  const user = await requireRole("DOCTOR");
  if (!user || !user.doctorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const doctorId = user.doctorId;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const dateValue = typeof body.date === "string" ? body.date : "";
    const type = typeof body.type === "string" ? body.type : "BLOCKED_RANGE";
    const startTime = typeof body.startTime === "string" ? body.startTime : "";
    const endTime = typeof body.endTime === "string" ? body.endTime : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const date = parseDateInput(dateValue);

    if (!date) {
      return NextResponse.json(
        { error: "Огнооны формат буруу байна." },
        { status: 400 },
      );
    }

    const validTypes = [
      "DAY_OFF",
      "BLOCKED_RANGE",
      "SCHEDULE_OVERRIDE",
    ] as const;
    const availabilityType = type as (typeof validTypes)[number];
    if (!validTypes.includes(availabilityType)) {
      return NextResponse.json(
        { error: "Чөлөөний төрөл буруу байна." },
        { status: 400 },
      );
    }

    if (dateValue < clinicDateKey())
      throw new HttpError(400, "Өнгөрсөн өдөрт чөлөө бүртгэх боломжгүй.");
    if (
      type !== "DAY_OFF" &&
      (!timePattern.test(startTime) ||
        !timePattern.test(endTime) ||
        startTime >= endTime)
    )
      throw new HttpError(400, "Эхлэх, дуусах цагаа шалгана уу.");
    const item = await prisma.$transaction(async (tx) => {
      const request = await tx.doctorAvailabilityException.create({
        data: {
          doctorId,
          date,
          type: availabilityType,
          startTime: type === "DAY_OFF" ? null : startTime,
          endTime: type === "DAY_OFF" ? null : endTime,
          reason: reason || null,
          isActive: false,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "DOCTOR_LEAVE_REQUESTED",
          entity: "DoctorAvailabilityException",
          entityId: request.id,
        },
      });
      return request;
    });
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const user = await requireRole("DOCTOR");
  if (!user || !user.doctorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const doctorId = user.doctorId;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json(
        { error: "Exception ID is required." },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const pending = await tx.doctorAvailabilityException.findFirst({
        where: { id, doctorId, isActive: false },
      });
      if (!pending) {
        throw new HttpError(
          409,
          "Зөвхөн хүлээгдэж буй хүсэлтийг цуцалж болно.",
        );
      }
      await tx.doctorAvailabilityException.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "DOCTOR_LEAVE_CANCELLED",
          entity: "DoctorAvailabilityException",
          entityId: id,
          metadata: {
            date: pending.date.toISOString(),
            type: pending.type,
            startTime: pending.startTime,
            endTime: pending.endTime,
            reason: pending.reason,
          },
        },
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
