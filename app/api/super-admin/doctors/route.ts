import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { clinicDateKey } from "@/lib/doctor-workspace";
import { apiError } from "@/lib/security/http";

export async function GET() {
  try {
    if (!await requireRole("SUPER_ADMIN", "ADMIN")) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const today = new Date(`${clinicDateKey()}T00:00:00Z`);
    const [doctors, totals, todayTotals, patientGroups, schedules] = await Promise.all([
      prisma.doctor.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] }),
      prisma.appointment.groupBy({ by: ["doctorId", "status"], _count: true }),
      prisma.appointment.groupBy({ by: ["doctorId", "status"], where: { appointmentDate: { gte: today, lt: new Date(today.getTime() + 86400000) } }, _count: true }),
      prisma.appointment.groupBy({ by: ["doctorId", "patientPhone", "status"] }),
      prisma.doctorSchedule.groupBy({ by: ["doctorId"], where: { isDayOff: false, isActive: true }, _count: true }),
    ]);
    const data = doctors.map(doctor => {
      const groups = totals.filter(row => row.doctorId === doctor.id);
      const todayGroups = todayTotals.filter(row => row.doctorId === doctor.id);
      const patients = patientGroups.filter(row => row.doctorId === doctor.id);
      const count = (status: string) => groups.find(row => row.status === status)?._count ?? 0;
      return {
        id: doctor.id, name: doctor.name, title: doctor.title, specialty: doctor.specialty,
        phone: doctor.phone, email: doctor.email, avatarUrl: doctor.avatarUrl,
        telegramChatId: doctor.telegramChatId, isActive: doctor.isActive,
        totalAppointments: groups.reduce((sum, row) => sum + row._count, 0),
        completedAppointments: count("COMPLETED"), pendingAppointments: count("PENDING"),
        cancelledAppointments: count("CANCELLED"), noShowAppointments: count("NO_SHOW"),
        todayAppointments: todayGroups.reduce((sum, row) => sum + row._count, 0),
        upcomingAppointments: todayGroups.filter(row => ["PENDING", "CONFIRMED"].includes(row.status)).reduce((sum, row) => sum + row._count, 0),
        patientsBooked: new Set(patients.map(row => row.patientPhone)).size,
        patientsSeen: new Set(patients.filter(row => row.status === "COMPLETED").map(row => row.patientPhone)).size,
        workingDays: schedules.find(row => row.doctorId === doctor.id)?._count ?? 0,
      };
    });
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiError(error); }
}
