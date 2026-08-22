import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
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

  return NextResponse.json({ success: true, data: items });
}

export async function POST(request: Request) {
  const user = await requireRole("DOCTOR");
  if (!user || !user.doctorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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
        { error: "Invalid date format." },
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
        { error: "Invalid exception type." },
        { status: 400 },
      );
    }

    if (type === "DAY_OFF") {
      const item = await prisma.doctorAvailabilityException.create({
        data: {
          doctorId: user.doctorId,
          date,
          type: "DAY_OFF",
          reason: reason || "Day off",
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
        { error: "Provide a valid time range for this exception." },
        { status: 400 },
      );
    }

    const item = await prisma.doctorAvailabilityException.create({
      data: {
        doctorId: user.doctorId,
        date,
        type: availabilityType,
        startTime,
        endTime,
        reason: reason || "Doctor exception",
      },
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save your exception.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await requireRole("DOCTOR");
  if (!user || !user.doctorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json(
        { error: "Exception ID is required." },
        { status: 400 },
      );
    }

    await prisma.doctorAvailabilityException.deleteMany({
      where: { id, doctorId: user.doctorId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete the exception.",
      },
      { status: 500 },
    );
  }
}
