import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ScheduleInput = { dayOfWeek: unknown; startTime: unknown; endTime: unknown; isDayOff: unknown };
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: doctorId } = await context.params;
  try {
    const schedules = (await request.json()) as ScheduleInput[];
    if (!Array.isArray(schedules) || schedules.length !== 7) {
      return NextResponse.json({ error: "7 хоногийн бүх хуваарийг илгээнэ үү." }, { status: 400 });
    }
    const seenDays = new Set<number>();
    const data = schedules.map((schedule) => {
      const dayOfWeek = Number(schedule.dayOfWeek);
      const isDayOff = Boolean(schedule.isDayOff);
      if (
        !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || seenDays.has(dayOfWeek) ||
        typeof schedule.startTime !== "string" || typeof schedule.endTime !== "string" ||
        !timePattern.test(schedule.startTime) || !timePattern.test(schedule.endTime) ||
        schedule.startTime >= schedule.endTime
      ) {
        throw new Error("Хуваарийн мэдээлэл буруу байна.");
      }
      seenDays.add(dayOfWeek);
      return { doctorId, dayOfWeek, startTime: schedule.startTime, endTime: schedule.endTime, isDayOff };
    });
    await prisma.$transaction(data.map((schedule) => prisma.doctorSchedule.upsert({
      where: { doctorId_dayOfWeek: { doctorId, dayOfWeek: schedule.dayOfWeek } },
      create: schedule,
      update: schedule,
    })));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/admin/doctors/[id]/schedule error:", error);
    return NextResponse.json({ error: "Хуваарь хадгалахад алдаа гарлаа." }, { status: 400 });
  }
}
