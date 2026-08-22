import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

function isSameDay(date: Date, target: Date) {
  return (
    date.getUTCFullYear() === target.getUTCFullYear() &&
    date.getUTCMonth() === target.getUTCMonth() &&
    date.getUTCDate() === target.getUTCDate()
  );
}

export async function GET() {
  const user = await requireRole("SUPER_ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const tomorrow = new Date(todayStart);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const doctors = await prisma.doctor.findMany({
    orderBy: { name: "asc" },
  });

  const doctorRows = await Promise.all(
    doctors.map(async (doctor) => {
      const appointments = await prisma.appointment.findMany({
        where: { doctorId: doctor.id },
        select: {
          id: true,
          patientId: true,
          appointmentDate: true,
          status: true,
        },
      });

      const patientIds = new Set(appointments.map((item) => item.patientId));
      const completedIds = new Set(
        appointments
          .filter((item) => item.status === "COMPLETED")
          .map((item) => item.patientId),
      );

      const workingDays = await prisma.doctorSchedule.count({
        where: { doctorId: doctor.id, isDayOff: false },
      });

      const todayAppointments = appointments.filter((item) =>
        isSameDay(item.appointmentDate, now),
      ).length;

      const upcomingAppointments = appointments.filter(
        (item) =>
          item.appointmentDate >= todayStart &&
          item.appointmentDate < tomorrow &&
          ["PENDING", "CONFIRMED"].includes(item.status),
      ).length;

      return {
        id: doctor.id,
        name: doctor.name,
        title: doctor.title,
        phone: doctor.phone,
        email: doctor.email,
        isActive: doctor.isActive,
        totalAppointments: appointments.length,
        completedAppointments: appointments.filter(
          (item) => item.status === "COMPLETED",
        ).length,
        pendingAppointments: appointments.filter(
          (item) => item.status === "PENDING",
        ).length,
        cancelledAppointments: appointments.filter(
          (item) => item.status === "CANCELLED",
        ).length,
        noShowAppointments: appointments.filter(
          (item) => item.status === "NO_SHOW",
        ).length,
        todayAppointments,
        upcomingAppointments,
        patientsBooked: patientIds.size,
        patientsSeen: completedIds.size,
        workingDays,
      };
    }),
  );

  return NextResponse.json({ success: true, data: doctorRows });
}
