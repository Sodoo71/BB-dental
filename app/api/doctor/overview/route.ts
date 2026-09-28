import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appointmentPatient, clinicDateKey } from "@/lib/doctor-workspace";
import { getDoctorDaySchedule } from "@/lib/availability";
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

  const today = new Date(`${clinicDateKey()}T00:00:00Z`);

  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

  const [doctor, schedules, appointments] = await Promise.all([
    prisma.doctor.findUnique({
      where: { id: user.doctorId },
      select: { id: true, name: true, title: true, phone: true, email: true },
    }),
    getDoctorDaySchedule(user.doctorId, today),
    prisma.appointment.findMany({
      where: {
        doctorId: user.doctorId,

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
    return date >= tomorrow && date < nextWeek && ["PENDING", "CONFIRMED"].includes(appointment.status);
  });

  const start = toMinutes(schedules.startTime);
  const end = toMinutes(schedules.endTime);
  const workingMinutes = schedules.isDayOff ? 0 : Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i).filter(minute => !schedules.blockedRanges.some(range => minute >= toMinutes(range.startTime) && minute < toMinutes(range.endTime))).length;

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
    const patientId = appointment.patient?.id || appointment.patientPhone;
    const name = appointment.patient?.fullName || appointment.patientName;
    const phone = appointment.patient?.phone || appointment.patientPhone;
    const current = patientMap.get(patientId) ?? {
      id: patientId,
      patientId,
      name,
      phone,
      totalAppointments: 0,
      lastAppointment: null,
      nextAppointment: null,
    };

    if (appointment.status === "COMPLETED") current.totalAppointments += 1;
    const appointmentTime = new Date(appointment.appointmentDate).getTime();
    if (
      appointment.status === "COMPLETED" && (!current.lastAppointment ||
      appointmentTime > new Date(current.lastAppointment).getTime())
    ) {
      current.lastAppointment = appointment.appointmentDate.toISOString();
    }
    if (
      ["PENDING", "CONFIRMED"].includes(appointment.status) && appointmentTime >= today.getTime() && (!current.nextAppointment ||
      appointmentTime < new Date(current.nextAppointment).getTime())
    ) {
      current.nextAppointment = appointment.appointmentDate.toISOString();
    }
    patientMap.set(patientId, current);
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
      todayAppointments: todayAppointments.map(appointmentPatient),
      upcomingAppointments: upcomingAppointments.map(appointmentPatient),
      patients,
    },
  });
}
