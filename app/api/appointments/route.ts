import { NextResponse } from "next/server";
import { Gender } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyDoctorOnTelegram } from "@/lib/telegram";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function addMinutes(startTime: string, durationMin: number) {
  const match = timePattern.exec(startTime);
  if (!match) return null;

  const totalMinutes = Number(match[1]) * 60 + Number(match[2]) + durationMin;
  if (totalMinutes >= 24 * 60) return null;
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseAppointmentDate(value: string) {
  const match = datePattern.exec(value);
  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

// 1. Шинэ цаг захиалга үүсгэх (POST)
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

    // Шаардлагатай мэдээлэл дутуу байгааг шалгах
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

    const date = parseAppointmentDate(appointmentDate);
    const normalizedPhone = phone.trim();
    const normalizedName = fullName.trim();
    const parsedAge = age === "" || age === undefined ? null : Number(age);
    const validGenders = Object.values(Gender);

    if (
      !normalizedName ||
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
      select: { durationMin: true },
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

    const endTime = addMinutes(startTime, service.durationMin);
    if (!endTime) {
      return NextResponse.json(
        { error: "Цагийн формат буруу байна." },
        { status: 400 },
      );
    }

    const schedule = await prisma.doctorSchedule.findUnique({
      where: { doctorId_dayOfWeek: { doctorId, dayOfWeek: date.getUTCDay() } },
    });
    if (
      !schedule ||
      schedule.isDayOff ||
      startTime < schedule.startTime ||
      endTime > schedule.endTime
    ) {
      return NextResponse.json(
        {
          error:
            "Энэ эмч тухайн өдөр ажиллахгүй эсвэл сонгосон цаг боломжгүй байна.",
        },
        { status: 409 },
      );
    }
    const nextDay = new Date(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const conflicts = await prisma.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate: { gte: date, lt: nextDay },
        status: { not: "CANCELLED" },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: { id: true },
    });
    if (conflicts) {
      return NextResponse.json(
        { error: "Энэ цагийг өөр хүн захиалсан байна. Өөр цаг сонгоно уу." },
        { status: 409 },
      );
    }

    const newAppointment = await prisma.appointment.create({
      data: {
        patient: {
          connectOrCreate: {
            where: { phone: normalizedPhone },
            create: {
              phone: normalizedPhone,
              fullName: normalizedName,
              age: parsedAge,
              gender: gender as Gender | null | undefined,
            },
          },
        },
        appointmentDate: date,
        startTime,
        endTime,
        doctor: { connect: { id: doctorId } },
        service: { connect: { id: serviceId } },
        chiefComplaint:
          typeof chiefComplaint === "string"
            ? chiefComplaint.trim() || null
            : null,
        status: "PENDING",
      },
    });

    const patient = await prisma.patient.findUnique({
      where: { phone: normalizedPhone },
      select: { fullName: true, phone: true },
    });
    const notificationSent =
      patient && doctor.telegramChatId
        ? await notifyDoctorOnTelegram({
            chatId: doctor.telegramChatId,
            doctorName: doctor.name,
            patientName: patient.fullName,
            patientPhone: patient.phone,
            serviceName:
              (
                await prisma.service.findUnique({
                  where: { id: serviceId },
                  select: { name: true },
                })
              )?.name ?? "Үйлчилгээ",
            appointmentDate: date,
            startTime,
            chiefComplaint:
              typeof chiefComplaint === "string"
                ? chiefComplaint.trim() || null
                : null,
          }).catch((error) => {
            console.error("Telegram notification error:", error);
            return false;
          })
        : false;

    return NextResponse.json(
      { success: true, data: newAppointment, notificationSent },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("❌ [POST /api/appointments Error]:", error);
    return NextResponse.json(
      {
        error: "Захиалга үүсгэхэд алдаа гарлаа.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
