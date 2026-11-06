import type { Prisma } from "@/app/generated/prisma/client";
import { ApiError } from "./http";
import { today } from "./domain";
import { coversAppointment, workIntervals } from "./work-schedule";

export async function ensureWorkCoverage(
  tx: Prisma.TransactionClient,
  doctorId: string,
  dates?: string[],
) {
  const appointments = await tx.appointment.findMany({
    where: {
      doctorId,
      date: { gte: today(), ...(dates ? { in: dates } : {}) },
      status: { in: ["PENDING", "CONFIRMED", "ARRIVED"] },
    },
    select: { date: true, startTime: true, endTime: true },
  });
  if (!appointments.length) return;
  const schedules = await tx.schedule.findMany({ where: { doctorId } });
  const leaves = await tx.leave.findMany({
    where: {
      doctorId,
      status: "APPROVED",
      date: { in: [...new Set(appointments.map((a) => a.date))] },
    },
  });
  for (const a of appointments) {
    const weekly = schedules.find(
      (s) => s.weekday === new Date(`${a.date}T12:00:00Z`).getUTCDay(),
    );
    if (
      !coversAppointment(
        workIntervals(
          weekly,
          leaves.filter((l) => l.date === a.date),
        ),
        a,
      )
    )
      throw new ApiError(
        409,
        "Хуваарийн өөрчлөлт захиалгатай зөрчилдөж байна. Эхлээд цагийг шилжүүлнэ үү.",
      );
  }
}

export async function ensureSingleOverride(
  tx: Prisma.TransactionClient,
  doctorId: string,
  date: string,
  excludeId?: string,
) {
  if (
    await tx.leave.count({
      where: {
        doctorId,
        date,
        kind: "SCHEDULE_OVERRIDE",
        status: "APPROVED",
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    })
  )
    throw new ApiError(
      409,
      "Энэ өдрийн тусгай ажиллах цаг аль хэдийн батлагдсан байна.",
    );
}
