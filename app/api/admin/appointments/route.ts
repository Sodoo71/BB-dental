import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notifyDoctorOnTelegram } from "@/lib/telegram";
import {
  ensureAppointmentSlotIsAvailable,
  parseDateInput,
} from "@/lib/availability";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

function addMinutes(startTime: string, durationMin: number) {
  const match = timePattern.exec(startTime);
  if (!match) return null;
  const totalMinutes = Number(match[1]) * 60 + Number(match[2]) + durationMin;
  if (totalMinutes >= 24 * 60 || durationMin <= 0) return null;
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const user = await requireRole("ADMIN", "SUPER_ADMIN", "RECEPTION");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId") || undefined;
  const serviceId = searchParams.get("serviceId") || undefined;
  const status = searchParams.get("status") || undefined;
  const patient = searchParams.get("patient") || undefined;
  const date = searchParams.get("date") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  try {
    const where: Record<string, unknown> = {};
    if (doctorId) where.doctorId = doctorId;
    if (serviceId) where.serviceId = serviceId;
    if (status && status !== "ALL") where.status = status;
    if (date) {
      const parsed = parseDateInput(date);
      if (!parsed)
        return NextResponse.json(
          { error: "Өдөрийн формат буруу байна." },
          { status: 400 },
        );
      const nextDay = new Date(parsed);
      nextDay.setUTCDate(parsed.getUTCDate() + 1);
      where.appointmentDate = { gte: parsed, lt: nextDay };
    }
    if (startDate || endDate) {
      where.appointmentDate = {
        ...(startDate ? { gte: parseDateInput(startDate) ?? undefined } : {}),
        ...(endDate
          ? {
              lte: parseDateInput(endDate)
                ? new Date(
                    new Date(parseDateInput(endDate) as Date).getTime() +
                      86400000,
                  )
                : undefined,
            }
          : {}),
      };
    }
    if (patient) {
      where.OR = [
        { patientName: { contains: patient, mode: "insensitive" } },
        { patientPhone: { contains: patient } },
        { patient: { fullName: { contains: patient, mode: "insensitive" } } },
        { patient: { phone: { contains: patient } } },
      ];
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: { patient: true, doctor: true, service: true, notes: true },
      orderBy: { createdAt: "desc" },
    });

    const mapped = appointments.map((app) => ({
      ...app,
      patient: app.patient || {
        id: app.patientId || app.id,
        fullName: app.patientName,
        phone: app.patientPhone,
        age: null,
        gender: null,
      },
      notes: app.notes || [],
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: unknown) {
    console.error("❌ [GET /api/admin/appointments Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Захиалгын дата авахад алдаа гарлаа",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await requireRole("ADMIN", "SUPER_ADMIN", "RECEPTION");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const doctorId = typeof body.doctorId === "string" ? body.doctorId : "";
    const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
    const appointmentDate =
      typeof body.appointmentDate === "string" ? body.appointmentDate : "";
    const startTime = typeof body.startTime === "string" ? body.startTime : "";
    const patientId =
      typeof body.patientId === "string" ? body.patientId : null;
    const patientPhone =
      typeof body.patientPhone === "string" ? body.patientPhone.trim() : "";
    const patientName =
      typeof body.patientName === "string" ? body.patientName.trim() : "";
    const status = (
      typeof body.status === "string" ? body.status : "PENDING"
    ) as string;
    const chiefComplaint =
      typeof body.chiefComplaint === "string"
        ? body.chiefComplaint.trim()
        : null;

    if (!doctorId || !serviceId || !appointmentDate || !startTime) {
      return NextResponse.json(
        { error: "Эмч, үйлчилгээ, өдөр, цагийг сонгоно уу." },
        { status: 400 },
      );
    }

    const date = parseDateInput(appointmentDate);
    if (!date) {
      return NextResponse.json(
        { error: "Өдрийн формат буруу байна." },
        { status: 400 },
      );
    }

    if (!timePattern.test(startTime)) {
      return NextResponse.json(
        { error: "Цагийн формат буруу байна." },
        { status: 400 },
      );
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
      select: { id: true, durationMin: true },
    });
    if (!service) {
      return NextResponse.json(
        { error: "Үйлчилгээ олдсонгүй." },
        { status: 404 },
      );
    }

    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, isActive: true },
      select: { id: true },
    });
    if (!doctor) {
      return NextResponse.json(
        { error: "Сонгосон эмч олдсонгүй эсвэл идэвхгүй байна." },
        { status: 404 },
      );
    }
    const force = body.force === true;

    if (!force) {
      await ensureAppointmentSlotIsAvailable({
        doctorId,
        serviceId,
        appointmentDate: date,
        startTime,
      });
    }

    const durationMin = Number(service.durationMin);
    const endTime = addMinutes(startTime, durationMin);
    if (!endTime) {
      return NextResponse.json(
        { error: "Цагийн хэмжээ буруу байна." },
        { status: 400 },
      );
    }

    const patient = patientId
      ? await prisma.patient.findUnique({
          where: { id: patientId },
          select: { id: true, phone: true, fullName: true },
        })
      : null;

    if (!patient && (!patientPhone || !patientName)) {
      return NextResponse.json(
        { error: "Өвчтөний нэр болон утас шаардлагатай." },
        { status: 400 },
      );
    }

    const appointment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${doctorId}:${date.toISOString().slice(0, 10)}`}))::text`;

      const match = patientId
        ? await tx.patient.findUnique({
            where: { id: patientId },
            select: { id: true, fullName: true, phone: true },
          })
        : await tx.patient.findUnique({
            where: { phone: patientPhone },
            select: { id: true, fullName: true, phone: true },
          });

      const patientRecord =
        match ??
        (await tx.patient.create({
          data: {
            phone: patientPhone || `${Date.now()}`,
            fullName: patientName,
          },
          select: { id: true, fullName: true, phone: true },
        }));

      const existing = await tx.appointment.findFirst({
        where: {
          doctorId,
          appointmentDate: {
            gte: new Date(
              Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate(),
              ),
            ),
            lt: new Date(
              Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate() + 1,
              ),
            ),
          },
          status: { not: "CANCELLED" },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (existing) {
        throw new Error("Сонгосон цаг аль хэдийн захиалагдсан байна.");
      }

      const created = await tx.appointment.create({
        data: {
          patientName: patientRecord.fullName,
          patientPhone: patientRecord.phone,
          patientId: patientRecord.id,
          serviceId,
          doctorId,
          appointmentDate: date,
          startTime,
          endTime,
          status:
            status === "CONFIRMED" ||
            status === "PENDING" ||
            status === "COMPLETED" ||
            status === "NO_SHOW"
              ? status
              : "PENDING",
          chiefComplaint,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "APPOINTMENT_CREATED",
          entity: "Appointment",
          entityId: created.id,
        },
      });
      return created;
    });

    let notificationSent = false;
    if (doctorId && serviceId) {
      try {
        const doc = await prisma.doctor.findUnique({
          where: { id: doctorId },
          select: { name: true, telegramChatId: true },
        });
        const srv = await prisma.service.findUnique({
          where: { id: serviceId },
          select: { name: true },
        });
        if (doc && srv) {
          notificationSent = await notifyDoctorOnTelegram({
            chatId: doc.telegramChatId || "",
            appointmentId: appointment.id,
            doctorName: doc.name,
            patientName: appointment.patientName,
            patientPhone: appointment.patientPhone,
            serviceName: srv.name,
            appointmentDate: appointment.appointmentDate,
            startTime: appointment.startTime,
            chiefComplaint: appointment.chiefComplaint,
          });
        }
      } catch (tgErr) {
        console.error("Telegram admin appointment notify error:", tgErr);
      }
    }

    return NextResponse.json(
      { success: true, data: appointment, notificationSent },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("POST /api/admin/appointments error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Захиалгыг үүсгэхэд алдаа гарлаа.",
      },
      { status: 409 },
    );
  }
}
