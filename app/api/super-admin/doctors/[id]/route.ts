import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

type DoctorInput = Record<string, unknown>;

function readDoctorInput(input: DoctorInput) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const optionalString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  return {
    name,
    title: optionalString(input.title),
    phone: optionalString(input.phone),
    email: optionalString(input.email),
    avatarUrl: optionalString(input.avatarUrl),
    telegramChatId: optionalString(input.telegramChatId),
    isActive: typeof input.isActive === "boolean" ? input.isActive : true,
  };
}

function startOfDayUtc(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireRole("SUPER_ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;

  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: {
      schedules: { orderBy: { dayOfWeek: "asc" } },
      availabilityExceptions: { orderBy: { date: "asc" } },
      appointments: {
        include: { patient: true, service: true },
        orderBy: { appointmentDate: "desc" },
      },
    },
  });

  if (!doctor) {
    return NextResponse.json({ error: "Эмч олдсонгүй." }, { status: 404 });
  }

  const now = new Date();
  const todayStart = startOfDayUtc(now);
  const thisWeekStart = addDays(todayStart, -((now.getUTCDay() + 6) % 7));
  const thisMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const last30Days = addDays(todayStart, -30);
  const last90Days = addDays(todayStart, -90);

  const appointments = doctor.appointments;

  const countRange = (
    from: Date,
    to: Date,
    predicate?: (a: (typeof appointments)[number]) => boolean,
  ) =>
    appointments.filter((appointment) => {
      const inRange =
        appointment.appointmentDate >= from &&
        appointment.appointmentDate <= to;
      return inRange && (!predicate || predicate(appointment));
    }).length;

  const totalAppointments = appointments.length;
  const todayAppointments = countRange(
    todayStart,
    addDays(todayStart, 1),
    () => true,
  );
  const thisWeekAppointments = countRange(
    thisWeekStart,
    addDays(todayStart, 1),
    () => true,
  );
  const thisMonthAppointments = countRange(
    thisMonthStart,
    addDays(todayStart, 1),
    () => true,
  );
  const last30DaysAppointments = countRange(
    last30Days,
    addDays(todayStart, 1),
    () => true,
  );
  const last90DaysAppointments = countRange(
    last90Days,
    addDays(todayStart, 1),
    () => true,
  );

  const patientsBooked = new Set(
    appointments.map((appointment) => appointment.patientId),
  ).size;
  const patientsSeen = new Set(
    appointments
      .filter((appointment) => appointment.status === "COMPLETED")
      .map((appointment) => appointment.patientId),
  ).size;

  const workingDays = doctor.schedules.filter((slot) => !slot.isDayOff).length;
  const appointmentDays = new Set(
    appointments.map((appointment) =>
      startOfDayUtc(appointment.appointmentDate).toISOString(),
    ),
  ).size;
  const completedDays = new Set(
    appointments
      .filter((appointment) => appointment.status === "COMPLETED")
      .map((appointment) =>
        startOfDayUtc(appointment.appointmentDate).toISOString(),
      ),
  ).size;
  const dayOffDays = doctor.schedules.filter((slot) => slot.isDayOff).length;

  const statusBreakdown = {
    PENDING: appointments.filter(
      (appointment) => appointment.status === "PENDING",
    ).length,
    CONFIRMED: appointments.filter(
      (appointment) => appointment.status === "CONFIRMED",
    ).length,
    COMPLETED: appointments.filter(
      (appointment) => appointment.status === "COMPLETED",
    ).length,
    CANCELLED: appointments.filter(
      (appointment) => appointment.status === "CANCELLED",
    ).length,
    NO_SHOW: appointments.filter(
      (appointment) => appointment.status === "NO_SHOW",
    ).length,
  };

  const recentAppointments = appointments.slice(0, 8).map((appointment) => ({
    id: appointment.id,
    patientName: appointment.patient.fullName,
    patientPhone: appointment.patient.phone,
    serviceName: appointment.service.name,
    appointmentDate: appointment.appointmentDate,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    status: appointment.status,
  }));

  return NextResponse.json({
    success: true,
    data: {
      doctor: {
        id: doctor.id,
        name: doctor.name,
        title: doctor.title,
        phone: doctor.phone,
        email: doctor.email,
        avatarUrl: doctor.avatarUrl,
        telegramChatId: doctor.telegramChatId,
        isActive: doctor.isActive,
        createdAt: doctor.createdAt,
      },
      stats: {
        totalAppointments,
        todayAppointments,
        thisWeekAppointments,
        thisMonthAppointments,
        last30DaysAppointments,
        last90DaysAppointments,
        completedAppointments: statusBreakdown.COMPLETED,
        pendingAppointments: statusBreakdown.PENDING,
        cancelledAppointments: statusBreakdown.CANCELLED,
        noShowAppointments: statusBreakdown.NO_SHOW,
        patientsBooked,
        patientsSeen,
        workingDays,
        appointmentDays,
        completedDays,
        dayOffDays,
      },
      statusBreakdown,
      schedule: doctor.schedules,
      exceptions: doctor.availabilityExceptions,
      recentAppointments,
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireRole("SUPER_ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const input = readDoctorInput((await request.json()) as DoctorInput);
    if (!input.name) {
      return NextResponse.json(
        { error: "Эмчийн нэр заавал байна." },
        { status: 400 },
      );
    }

    const doctor = await prisma.doctor.update({
      where: { id },
      data: input,
    });

    return NextResponse.json({ success: true, data: doctor });
  } catch (error) {
    console.error("PATCH /api/super-admin/doctors/[id] error:", error);
    return NextResponse.json(
      { error: "Эмчийн мэдээлэл шинэчлэхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}
