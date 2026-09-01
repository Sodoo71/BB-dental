import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  ensureAppointmentSlotIsAvailable,
  parseDateInput,
} from "@/lib/availability";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

function addMinutes(startTime: string, durationMin: number) {
  const match = timePattern.exec(startTime);
  if (!match) return null;
  const totalMinutes = Number(match[1]) * 60 + Number(match[2]) + durationMin;
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
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
        { patient: { fullName: { contains: patient, mode: "insensitive" } } },
        { patient: { phone: { contains: patient } } },
      ];
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: { patient: true, doctor: true, service: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: appointments });
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
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
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
      const match = patientId
        ? await tx.patient.findUnique({
            where: { id: patientId },
            select: { id: true },
          })
        : await tx.patient.findUnique({
            where: { phone: patientPhone },
            select: { id: true },
          });

      const patientRecord =
        match ??
        (await tx.patient.create({
          data: {
            phone: patientPhone || `${Date.now()}`,
            fullName: patientName,
          },
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

      return tx.appointment.create({
        data: {
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
    });

    return NextResponse.json(
      { success: true, data: appointment },
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
