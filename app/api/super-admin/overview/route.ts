import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const user = await requireRole("SUPER_ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const [
    totalDoctors,
    activeDoctors,
    totalPatients,
    totalAppointments,
    todayAppointments,
    completedAppointments,
    cancelledAppointments,
    noShowAppointments,
    upcomingAppointments,
    doctorsWorkingToday,
  ] = await Promise.all([
    prisma.doctor.count(),
    prisma.doctor.count({ where: { isActive: true } }),
    prisma.patient.count(),
    prisma.appointment.count(),
    prisma.appointment.count({
      where: {
        appointmentDate: { gte: todayStart, lt: todayEnd },
      },
    }),
    prisma.appointment.count({ where: { status: "COMPLETED" } }),
    prisma.appointment.count({ where: { status: "CANCELLED" } }),
    prisma.appointment.count({ where: { status: "NO_SHOW" } }),
    prisma.appointment.count({
      where: {
        appointmentDate: { gte: todayStart },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    }),
    prisma.doctorSchedule.count({
      where: {
        dayOfWeek: now.getUTCDay(),
        isDayOff: false,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      totalDoctors,
      activeDoctors,
      totalPatients,
      totalAppointments,
      todayAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      upcomingAppointments,
      doctorsWorkingToday,
    },
  });
}
