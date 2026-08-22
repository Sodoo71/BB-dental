import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

type ScheduleInput = {
  dayOfWeek: unknown;
  startTime: unknown;
  endTime: unknown;
  isDayOff: unknown;
};
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

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

  const schedules = await prisma.doctorSchedule.findMany({
    where: { doctorId },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json({ success: true, data: schedules });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: doctorId } = await context.params;
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });
    if (!doctor)
      return NextResponse.json({ error: "Эмч олдсонгүй." }, { status: 404 });
    const schedules = (await request.json()) as ScheduleInput[];
    if (!Array.isArray(schedules) || schedules.length !== 7) {
      return NextResponse.json(
        { error: "7 хоногийн бүх хуваарийг илгээнэ үү." },
        { status: 400 },
      );
    }
    const seenDays = new Set<number>();
    const data = schedules.map((schedule) => {
      const dayOfWeek = Number(schedule.dayOfWeek);
      const isDayOff = Boolean(schedule.isDayOff);
      if (
        !Number.isInteger(dayOfWeek) ||
        dayOfWeek < 0 ||
        dayOfWeek > 6 ||
        seenDays.has(dayOfWeek)
      ) {
        throw new Error("Хуваарийн мэдээлэл буруу байна.");
      }
      seenDays.add(dayOfWeek);

      if (isDayOff) {
        return {
          doctorId,
          dayOfWeek,
          startTime: "09:00",
          endTime: "17:00",
          isDayOff: true,
        };
      }

      const startTime = typeof schedule.startTime === "string"
        ? schedule.startTime.trim()
        : "09:00";
      const endTime = typeof schedule.endTime === "string"
        ? schedule.endTime.trim()
        : "17:00";

      if (
        !timePattern.test(startTime) ||
        !timePattern.test(endTime) ||
        timeToMinutes(startTime) >= timeToMinutes(endTime)
      ) {
        throw new Error("Хуваарийн мэдээлэл буруу байна.");
      }

      return {
        doctorId,
        dayOfWeek,
        startTime,
        endTime,
        isDayOff: false,
      };
    });

    await prisma.$transaction(
      data.map((schedule) =>
        prisma.doctorSchedule.upsert({
          where: {
            doctorId_dayOfWeek: { doctorId, dayOfWeek: schedule.dayOfWeek },
          },
          create: schedule,
          update: schedule,
        }),
      ),
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/admin/doctors/[id]/schedule error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Хуваарь хадгалахад алдаа гарлаа.",
      },
      { status: 400 },
    );
  }
}
