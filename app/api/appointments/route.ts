import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { apiError, HttpError } from "@/lib/security/http";
import { phoneSchema } from "@/lib/validation/phone";
import { bookingConfirmationSelect } from "@/lib/appointments/dto";
import { Gender } from "@/app/generated/prisma/client";
import {
  ensureAppointmentSlotIsAvailable,
  parseDateInput,
} from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { notifyDoctorOnTelegram } from "@/lib/telegram";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

function addMinutes(startTime: string, durationMin: number) {
  const match = timePattern.exec(startTime);
  if (!match) return null;

  const totalMinutes = Number(match[1]) * 60 + Number(match[2]) + durationMin;
  if (totalMinutes >= 24 * 60) return null;
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Хүсэлтийн мэдээлэл буруу байна." },
        { status: 400 },
      );
    }

    const {
      phoneConfirmed,
      fullName,
      phone,
      age,
      gender,
      appointmentDate,
      startTime,
      doctorId,
      serviceId,
      chiefComplaint,
    } = body as Record<string, unknown>;

    if (
      typeof fullName !== "string" ||
      typeof phone !== "string" ||
      typeof appointmentDate !== "string" ||
      typeof startTime !== "string" ||
      typeof serviceId !== "string" ||
      typeof doctorId !== "string"
    ) {
      return NextResponse.json(
        { error: "Нэр, утас, огноо болон цагийг заавал бөглөнө үү." },
        { status: 400 },
      );
    }

    const date = parseDateInput(appointmentDate);
    if (phoneConfirmed !== true) throw new HttpError(400, "Утасны дугаараа зөв эсэхийг баталгаажуулна уу.");
    const normalizedPhone = phoneSchema.parse(phone);
    await rateLimit("public-booking", "clinic", 200, 15);
    await rateLimit("public-booking-phone", normalizedPhone, 5, 15);
    const normalizedName = fullName.trim();
    const parsedAge = age === "" || age === undefined ? null : Number(age);
    const validGenders = Object.values(Gender);

    if (
      !normalizedName || normalizedName.length > 120 ||
      (typeof chiefComplaint === "string" && chiefComplaint.length > 2000) ||
      !normalizedPhone ||
      !date ||
      !timePattern.test(startTime) ||
      (parsedAge !== null &&
        (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 150)) ||
      (gender !== undefined &&
        gender !== null &&
        (typeof gender !== "string" ||
          !validGenders.includes(gender as Gender)))
    ) {
      return NextResponse.json(
        { error: "Оруулсан мэдээллээ шалгана уу." },
        { status: 400 },
      );
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
      select: { id: true, durationMin: true, name: true },
    });
    if (!service) {
      return NextResponse.json(
        { error: "Сонгосон үйлчилгээ олдсонгүй." },
        { status: 404 },
      );
    }

    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, isActive: true },
      select: { id: true, name: true, telegramChatId: true },
    });
    if (!doctor) {
      return NextResponse.json(
        { error: "Сонгосон эмч олдсонгүй." },
        { status: 404 },
      );
    }

    const durationMin = Number(service.durationMin);
    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      return NextResponse.json(
        { error: "Үйлчилгээний хугацаа буруу байна." },
        { status: 400 },
      );
    }

    const endTime = addMinutes(startTime, durationMin);
    if (!endTime) {
      return NextResponse.json(
        { error: "Цагийн формат буруу байна." },
        { status: 400 },
      );
    }

    await ensureAppointmentSlotIsAvailable({
      doctorId,
      serviceId,
      appointmentDate: date,
      startTime,
    });

    const appointment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${doctorId}:${date.toISOString().slice(0, 10)}`}))::text`;
      const currentService = await tx.service.findFirst({ where: { id: serviceId, isActive: true }, select: { durationMin: true } });
      if (!currentService || currentService.durationMin !== durationMin) throw new HttpError(409, "Үйлчилгээний хугацаа өөрчлөгдсөн байна. Дахин цаг сонгоно уу.");

      await ensureAppointmentSlotIsAvailable({ doctorId, serviceId, appointmentDate: date, startTime, db: tx });
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
        select: { id: true },
      });

      if (existing) {
        throw new HttpError(409, "Энэ цагийг өөр хүн захиалсан байна. Өөр цаг сонгоно уу.");
      }

      const patient = await tx.patient.upsert({
        where: { phone: normalizedPhone },
        // Confirmation checks typing only; it does not prove phone ownership.
        update: {},
        create: {
          phone: normalizedPhone,
          fullName: normalizedName,
          age: parsedAge,
          gender: gender as Gender | null | undefined,
        },
      });

      const created = await tx.appointment.create({
        data: {
          patientName: normalizedName,
          patientPhone: normalizedPhone,
          patientId: patient.id,
          serviceId: service.id,
          doctorId: doctor.id,
          appointmentDate: date,
          startTime,
          endTime,
          status: "PENDING",
          chiefComplaint:
            typeof chiefComplaint === "string"
              ? chiefComplaint.trim() || null
              : null,
        },
        select: bookingConfirmationSelect,
      });
      await tx.auditLog.create({ data: { action: "APPOINTMENT_CREATED", entity: "Appointment", entityId: created.id } });
      return created;
    });

    let notificationSent = false;
    {
      try {
        notificationSent = await notifyDoctorOnTelegram({
          chatId: doctor.telegramChatId || "",
          appointmentId: appointment.id,
          doctorName: doctor.name,
          patientName: normalizedName,
          patientPhone: normalizedPhone,
          serviceName: service.name,
          appointmentDate: date,
          startTime,
          chiefComplaint:
            typeof chiefComplaint === "string"
              ? chiefComplaint.trim() || null
              : null,
        });
      } catch (error) {
        console.error("Telegram notification error:", error);
      }
    }

    return NextResponse.json(
      { success: true, data: appointment, notificationSent },
      { status: 201 },
    );
  } catch (error: unknown) {
    return apiError(error);
  }
}
