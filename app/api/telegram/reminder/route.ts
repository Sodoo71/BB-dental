import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notifyAppointmentReminder } from "@/lib/telegram";

export async function POST(request: Request) {
  const user = await requireRole("ADMIN", "SUPER_ADMIN", "DOCTOR");
  if (!user) {
    return NextResponse.json(
      { error: "Хандах эрхгүй байна." },
      { status: 403 },
    );
  }

  try {
    const { appointmentId } = await request.json();
    if (!appointmentId) {
      return NextResponse.json(
        { error: "Захиалгын ID оруулна уу." },
        { status: 400 },
      );
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: true,
        service: true,
      },
    });

    if (!appointment || (user.role === "DOCTOR" && appointment.doctorId !== user.doctorId)) {
      return NextResponse.json(
        { error: "Захиалга олдсонгүй." },
        { status: 404 },
      );
    }

    const chatId =
      appointment.doctor?.telegramChatId || process.env.ADMIN_CHAT_ID;

    if (!chatId) {
      return NextResponse.json(
        { error: "Эмч болон админы Telegram Chat ID бүртгэгдээгүй байна." },
        { status: 400 },
      );
    }

    const sent = await notifyAppointmentReminder({
      chatId,
      doctorName: appointment.doctor?.name || "Эмч",
      patientName: appointment.patientName,
      patientPhone: appointment.patientPhone,
      serviceName: appointment.service.name,
      appointmentDate: appointment.appointmentDate,
      startTime: appointment.startTime,
    });

    if (!sent) {
      return NextResponse.json(
        { error: "Telegram мэдэгдэл илгээхэд алдаа гарлаа." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Telegram сануулга амжилттай илгээгдлээ.",
    });
  } catch (error) {
    console.error("POST /api/telegram/reminder error:", error);
    return NextResponse.json(
      { error: "Сануулга илгээх үед алдаа гарлаа." },
      { status: 500 },
    );
  }
}
