import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const MONGOLIAN_DAYS = ["Ням", "Дав", "Мяг", "Лха", "Пүр", "Баа", "Бям"];

export async function GET() {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  // Past 7 days window (from 6 days ago to today)
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

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
    allAppointmentsForStats,
    doctorsList,
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
    prisma.appointment.findMany({
      select: {
        id: true,
        status: true,
        appointmentDate: true,
        doctorId: true,
        serviceId: true,
        service: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    }),
    prisma.doctor.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        title: true,
        avatarUrl: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  // Financial calculations
  let totalCompletedRevenue = 0;
  let todayEstimatedRevenue = 0;
  let pendingPotentialRevenue = 0;

  const serviceMap = new Map<
    string,
    { id: string; name: string; count: number; revenue: number }
  >();

  allAppointmentsForStats.forEach((app) => {
    const price = app.service?.price || 0;
    const isToday =
      app.appointmentDate >= todayStart && app.appointmentDate < todayEnd;

    if (app.status === "COMPLETED") {
      totalCompletedRevenue += price;
    }

    if (isToday && (app.status === "COMPLETED" || app.status === "CONFIRMED")) {
      todayEstimatedRevenue += price;
    }

    if (app.status === "PENDING" || app.status === "CONFIRMED") {
      pendingPotentialRevenue += price;
    }

    if (app.service) {
      const existing = serviceMap.get(app.service.id) ?? {
        id: app.service.id,
        name: app.service.name,
        count: 0,
        revenue: 0,
      };
      existing.count += 1;
      if (app.status === "COMPLETED") {
        existing.revenue += price;
      }
      serviceMap.set(app.service.id, existing);
    }
  });

  // Top services sorted by booking count
  const topServices = Array.from(serviceMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((s) => ({
      ...s,
      percentage:
        totalAppointments > 0
          ? Math.round((s.count / totalAppointments) * 100)
          : 0,
    }));

  // Doctor workload breakdown
  const doctorWorkload = doctorsList.map((doc) => {
    const docApps = allAppointmentsForStats.filter(
      (app) => app.doctorId === doc.id,
    );
    const completedCount = docApps.filter(
      (app) => app.status === "COMPLETED",
    ).length;
    const confirmedCount = docApps.filter(
      (app) => app.status === "CONFIRMED",
    ).length;

    return {
      id: doc.id,
      name: doc.name,
      title: doc.title,
      avatarUrl: doc.avatarUrl,
      totalAppointments: docApps.length,
      completedCount,
      confirmedCount,
    };
  });

  // Past 7 days trend
  const weeklyTrend = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(todayStart);
    day.setUTCDate(day.getUTCDate() - i);
    const nextDay = new Date(day);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const dayAppointments = allAppointmentsForStats.filter(
      (a) => a.appointmentDate >= day && a.appointmentDate < nextDay,
    );

    const dayRevenue = dayAppointments
      .filter((a) => a.status === "COMPLETED")
      .reduce((sum, a) => sum + (a.service?.price || 0), 0);

    weeklyTrend.push({
      date: day.toISOString().slice(0, 10),
      dayName: MONGOLIAN_DAYS[day.getUTCDay()],
      total: dayAppointments.length,
      completed: dayAppointments.filter((a) => a.status === "COMPLETED").length,
      cancelled: dayAppointments.filter((a) => a.status === "CANCELLED").length,
      revenue: dayRevenue,
    });
  }

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
      totalCompletedRevenue,
      todayEstimatedRevenue,
      pendingPotentialRevenue,
      weeklyTrend,
      topServices,
      doctorWorkload,
    },
  });
}
