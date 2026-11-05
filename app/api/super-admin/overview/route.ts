import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { clinicDateKey } from "@/lib/doctor-workspace";
import { apiError } from "@/lib/security/http";
import { resolveDaySchedule } from "@/lib/availability-slots";

const days = ["Ням", "Дав", "Мяг", "Лха", "Пүр", "Баа", "Бям"];
export async function GET() {
  try {
    if (!await requireRole("ADMIN")) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const today = new Date(`${clinicDateKey()}T00:00:00Z`);
    const tomorrow = new Date(today.getTime() + 86400000);
    const weekStart = new Date(today.getTime() - 6 * 86400000);
    const [users, unlinkedDoctors, totalPatients, groups, weeklyGroups, doctorGroups, services, doctors, schedules, exceptions, upcomingAppointments] = await Promise.all([
      prisma.user.groupBy({ by: ["role", "status"], _count: true }),
      prisma.doctor.count({ where: { user: null } }),
      prisma.patient.count(),
      prisma.appointment.groupBy({ by: ["status", "serviceId"], _count: true }),
      prisma.appointment.groupBy({ by: ["status", "serviceId", "appointmentDate"], where: { appointmentDate: { gte: weekStart, lt: tomorrow } }, _count: true }),
      prisma.appointment.groupBy({ by: ["doctorId", "status"], _count: true }),
      prisma.service.findMany({ select: { id: true, name: true, price: true } }),
      prisma.doctor.findMany({ select: { id: true, name: true, title: true, avatarUrl: true, isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
      prisma.doctorSchedule.findMany({ where: { dayOfWeek: today.getUTCDay() } }),
      prisma.doctorAvailabilityException.findMany({ where: { date: { gte: today, lt: tomorrow }, isActive: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.appointment.count({ where: { appointmentDate: { gte: today }, status: { in: ["PENDING", "CONFIRMED"] } } }),
    ]);
    const statusCount = (status: string) => groups.filter(row => row.status === status).reduce((sum, row) => sum + row._count, 0);
    const priceMap = new Map(services.map(service => [service.id, service.price]));
    const totalAppointments = groups.reduce((sum, row) => sum + row._count, 0);
    const todayGroups = weeklyGroups.filter(row => row.appointmentDate >= today);
    const weeklyTrend = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(weekStart.getTime() + offset * 86400000);
      const next = new Date(date.getTime() + 86400000);
      const rows = weeklyGroups.filter(row => row.appointmentDate >= date && row.appointmentDate < next);
      return { date: date.toISOString().slice(0, 10), dayName: days[date.getUTCDay()],
        total: rows.reduce((sum, row) => sum + row._count, 0),
        completed: rows.filter(row => row.status === "COMPLETED").reduce((sum, row) => sum + row._count, 0),
        cancelled: rows.filter(row => row.status === "CANCELLED").reduce((sum, row) => sum + row._count, 0),
        revenue: rows.filter(row => row.status === "COMPLETED").reduce((sum, row) => sum + row._count * (priceMap.get(row.serviceId) ?? 0), 0),
      };
    });
    const topServices = services.map(service => {
      const rows = groups.filter(row => row.serviceId === service.id);
      const count = rows.reduce((sum, row) => sum + row._count, 0);
      return { id: service.id, name: service.name, count,
        revenue: rows.filter(row => row.status === "COMPLETED").reduce((sum, row) => sum + row._count * service.price, 0),
        percentage: totalAppointments ? Math.round(count / totalAppointments * 100) : 0,
      };
    }).filter(row => row.count).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)).slice(0, 5);
    const activeDoctors = doctors.filter(doctor => doctor.isActive);
    const doctorWorkload = activeDoctors.map(doctor => {
      const rows = doctorGroups.filter(row => row.doctorId === doctor.id);
      return { id: doctor.id, name: doctor.name, title: doctor.title, avatarUrl: doctor.avatarUrl,
        totalAppointments: rows.reduce((sum, row) => sum + row._count, 0),
        completedCount: rows.find(row => row.status === "COMPLETED")?._count ?? 0,
        confirmedCount: rows.find(row => row.status === "CONFIRMED")?._count ?? 0,
      };
    });
    return NextResponse.json({ success: true, data: {
      totalUsers: users.reduce((sum, row) => sum + row._count, 0) + unlinkedDoctors,
      pendingUsers: users.filter(row => row.status === "PENDING").reduce((sum, row) => sum + row._count, 0),
      totalAdmins: users.filter(row => ["ADMIN", "SUPER_ADMIN"].includes(row.role)).reduce((sum, row) => sum + row._count, 0),
      totalDoctors: doctors.length, activeDoctors: activeDoctors.length, totalPatients, totalAppointments,
      todayAppointments: todayGroups.reduce((sum, row) => sum + row._count, 0),
      pendingAppointments: statusCount("PENDING"), confirmedAppointments: statusCount("CONFIRMED"),
      completedAppointments: statusCount("COMPLETED"), cancelledAppointments: statusCount("CANCELLED"), noShowAppointments: statusCount("NO_SHOW"),
      upcomingAppointments, servicesCount: services.length,
      doctorsWorkingToday: activeDoctors.filter(doctor => {
        const schedule = resolveDaySchedule(schedules.find(row => row.doctorId === doctor.id) ?? null, exceptions.filter(row => row.doctorId === doctor.id));
        return !schedule.isDayOff && schedule.startTime && schedule.endTime;
      }).length,
      // Legacy keys retained for API compatibility. These are catalog estimates, never payment totals.
      totalCompletedRevenue: groups.filter(row => row.status === "COMPLETED").reduce((sum, row) => sum + row._count * (priceMap.get(row.serviceId) ?? 0), 0),
      todayEstimatedRevenue: todayGroups.filter(row => ["COMPLETED", "CONFIRMED"].includes(row.status)).reduce((sum, row) => sum + row._count * (priceMap.get(row.serviceId) ?? 0), 0),
      pendingPotentialRevenue: groups.filter(row => ["PENDING", "CONFIRMED"].includes(row.status)).reduce((sum, row) => sum + row._count * (priceMap.get(row.serviceId) ?? 0), 0),
      financialReporting: { basis: "CURRENT_CATALOG_ESTIMATE", collectedPayments: null, recognizedRevenue: null, expenses: null, receivables: null },
      weeklyTrend, topServices, doctorWorkload,
    } });
  } catch (error) { return apiError(error); }
}
