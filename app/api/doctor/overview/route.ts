import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

function toMinutes(time: string | null | undefined) {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

export async function GET() {
  const user = await requireRole("DOCTOR");
  if (!user || !user.doctorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const [doctor, schedules, appointments] = await Promise.all([
    prisma.doctor.findUnique({
      where: { id: user.doctorId },
      select: { id: true, name: true, title: true, phone: true, email: true },
    }),
    prisma.doctorSchedule.findMany({
      where: { doctorId: user.doctorId },
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        isDayOff: true,
      },
    }),
    prisma.appointment.findMany({
      where: {
        doctorId: user.doctorId,
        appointmentDate: {
          gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          lt: nextWeek,
        },
      },
      include: { patient: true, service: true },
      orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
    }),
  ]);

  if (!doctor) {
    return NextResponse.json(
      { error: "Doctor profile not found." },
      { status: 404 },
    );
  }

  const todayAppointments = appointments.filter((appointment) => {
    const date = new Date(appointment.appointmentDate);
    return date >= today && date < tomorrow;
  });

  const upcomingAppointments = appointments.filter((appointment) => {
    const date = new Date(appointment.appointmentDate);
    return date >= tomorrow && date < nextWeek;
  });

  const workingMinutes = schedules
    .filter((item) => !item.isDayOff)
    .reduce(
      (sum, item) =>
        sum + Math.max(0, toMinutes(item.endTime) - toMinutes(item.startTime)),
      0,
    );

  const patientMap = new Map<
    string,
    {
      id: string;
      patientId: string;
      name: string;
      phone: string;
      totalAppointments: number;
      lastAppointment: string | null;
      nextAppointment: string | null;
    }
  >();

  appointments.forEach((appointment) => {
    const patient = appointment.patient;
    const current = patientMap.get(patient.id) ?? {
      id: patient.id,
      patientId: patient.id,
      name: patient.fullName,
      phone: patient.phone,
      totalAppointments: 0,
      lastAppointment: null,
      nextAppointment: null,
    };

    current.totalAppointments += 1;
    const appointmentTime = new Date(appointment.appointmentDate).getTime();
    if (
      !current.lastAppointment ||
      appointmentTime > new Date(current.lastAppointment).getTime()
    ) {
      current.lastAppointment = appointment.appointmentDate.toISOString();
    }
    if (
      !current.nextAppointment ||
      appointmentTime < new Date(current.nextAppointment).getTime()
    ) {
      current.nextAppointment = appointment.appointmentDate.toISOString();
    }
    patientMap.set(patient.id, current);
  });

  const patients = Array.from(patientMap.values()).sort((a, b) => {
    const aValue = a.totalAppointments;
    const bValue = b.totalAppointments;
    return bValue - aValue;
  });

  return NextResponse.json({
    success: true,
    data: {
      doctor,
      stats: {
        todayAppointments: todayAppointments.length,
        upcoming: upcomingAppointments.length,
        completedToday: todayAppointments.filter(
          (item) => item.status === "COMPLETED",
        ).length,
        pending: appointments.filter((item) => item.status === "PENDING")
          .length,
        workingMinutes,
      },
      todayAppointments: todayAppointments,
      upcomingAppointments: upcomingAppointments,
      patients,
    },
  });
}
