import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(value: string | null) {
  if (!value || !datePattern.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  const serviceId = searchParams.get("serviceId");
  const date = parseDate(searchParams.get("date"));

  if (!doctorId || !serviceId || !date) {
    return NextResponse.json({ error: "Эмч, үйлчилгээ, өдөр сонгоно уу." }, { status: 400 });
  }

  try {
    const [doctor, service] = await Promise.all([
      prisma.doctor.findFirst({ where: { id: doctorId, isActive: true }, select: { id: true } }),
      prisma.service.findFirst({ where: { id: serviceId, isActive: true }, select: { durationMin: true } }),
    ]);
    if (!doctor || !service) {
      return NextResponse.json({ error: "Эмч эсвэл үйлчилгээ олдсонгүй." }, { status: 404 });
    }

    const schedule = await prisma.doctorSchedule.findUnique({
      where: { doctorId_dayOfWeek: { doctorId, dayOfWeek: date.getUTCDay() } },
    });
    if (!schedule || schedule.isDayOff) {
      return NextResponse.json({ success: true, data: [] });
    }

    const nextDay = new Date(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: { gte: date, lt: nextDay },
        status: { not: "CANCELLED" },
      },
      select: { startTime: true, endTime: true },
    });

    const slots: string[] = [];
    const opening = toMinutes(schedule.startTime);
    const closing = toMinutes(schedule.endTime);
    for (let start = opening; start + service.durationMin <= closing; start += 30) {
      const end = start + service.durationMin;
      const overlaps = appointments.some((appointment) => {
        const bookedStart = toMinutes(appointment.startTime);
        const bookedEnd = toMinutes(appointment.endTime);
        return start < bookedEnd && end > bookedStart;
      });
      if (!overlaps) slots.push(formatTime(start));
    }

    return NextResponse.json({ success: true, data: slots });
  } catch (error) {
    console.error("GET /api/availability error:", error);
    return NextResponse.json({ error: "Боломжит цагийг авахад алдаа гарлаа." }, { status: 500 });
  }
}
