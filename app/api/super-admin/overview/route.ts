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
    totalUsers,
    pendingUsers,
    totalAdmins,
    totalDoctors,
    activeDoctors,
    totalPatients,
    totalAppointments,
    todayAppointments,
    pendingAppointments,
    confirmedAppointments,
    completedAppointments,
    cancelledAppointments,
    noShowAppointments,
    upcomingAppointments,
    doctorsWorkingToday,
    servicesCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: false } }),
    prisma.user.count({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    }),
    prisma.doctor.count(),
    prisma.doctor.count({ where: { isActive: true } }),
    prisma.patient.count(),
    prisma.appointment.count(),
    prisma.appointment.count({
      where: {
        appointmentDate: { gte: todayStart, lt: todayEnd },
      },
    }),
    prisma.appointment.count({ where: { status: "PENDING" } }),
    prisma.appointment.count({ where: { status: "CONFIRMED" } }),
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
    prisma.service.count(),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      totalUsers,
      pendingUsers,
      totalAdmins,
      totalDoctors,
      activeDoctors,
      totalPatients,
      totalAppointments,
      todayAppointments,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      upcomingAppointments,
      doctorsWorkingToday,
      servicesCount,
    },
  });
}
