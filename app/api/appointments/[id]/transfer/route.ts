import { notifyDoctorOnTelegram } from "@/lib/telegram";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppointmentSlotIsAvailable } from "@/lib/availability";
import { apiError, HttpError } from "@/lib/security/http";
import { requireSessionUser } from "@/lib/auth";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (!user || !["DOCTOR", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Эрх хүрэлцэхгүй байна." }, { status: 403 });
  }

  const { id } = await props.params;

  try {
    const body = await request.json();
    const targetDoctorId = typeof body.targetDoctorId === "string" ? body.targetDoctorId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!targetDoctorId) {
      return NextResponse.json(
        { error: "Шилжүүлэх эмчийг сонгоно уу." },
        { status: 400 },
      );
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true, patient: true },
    });

    if (!appointment || (user.role === "DOCTOR" && appointment.doctorId !== user.doctorId)) {
      return NextResponse.json({ error: "Захиалга олдсонгүй." }, { status: 404 });
    }

    const targetDoctor = await prisma.doctor.findUnique({
      where: { id: targetDoctorId },
    });

    if (!targetDoctor || !targetDoctor.isActive || targetDoctor.id === appointment.doctorId) {
      return NextResponse.json({ error: "Шилжүүлэх эмч олдсонгүй." }, { status: 404 });
    }

    const prevDoctorName = appointment.doctor?.name || "Тодорхойгүй эмч";
    const authorName = user.name || (user.role === "DOCTOR" ? "Эмч" : "Ресепшн");

    const noteText = `Шилжүүлэг: ${prevDoctorName} -> ${targetDoctor.name}.${reason ? ` Шалтгаан: ${reason}` : ""}`;

    const updatedAppointment = await prisma.$transaction(async tx => {
      for (const doctorId of [appointment.doctorId, targetDoctorId].filter((id): id is string => Boolean(id)).sort()) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${doctorId}:${appointment.appointmentDate.toISOString().slice(0, 10)}`}))::text`;
      }
      const current = await tx.appointment.findFirst({ where: { id, doctorId: appointment.doctorId, status: { in: ["PENDING", "CONFIRMED"] } } });
      if (!current) throw new HttpError(409, "Энэ захиалга өөрчлөгдсөн эсвэл дууссан байна. Жагсаалтаа шинэчилнэ үү.");
      try { await ensureAppointmentSlotIsAvailable({ doctorId: targetDoctorId, serviceId: current.serviceId, appointmentDate: current.appointmentDate, startTime: current.startTime }); }
      catch { throw new HttpError(409, "Сонгосон эмч энэ цагт ажиллахгүй эсвэл өөр захиалгатай байна."); }
      const collision = await tx.appointment.findFirst({ where: { doctorId: targetDoctorId, appointmentDate: current.appointmentDate, status: { in: ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] }, startTime: { lt: current.endTime }, endTime: { gt: current.startTime } } });
      if (collision) throw new HttpError(409, "Сонгосон эмчийн цаг давхцаж байна.");
      const result = await tx.appointment.updateMany({ where: { id, doctorId: current.doctorId, status: current.status }, data: { doctorId: targetDoctorId } });
      if (!result.count) throw new HttpError(409, "Захиалга өөрчлөгдсөн байна. Дахин ачаална уу.");
      await tx.appointmentNote.create({ data: { appointmentId: id, note: noteText, author: authorName } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "APPOINTMENT_TRANSFERRED", entity: "Appointment", entityId: id, metadata: { from: current.doctorId, to: targetDoctorId } } });
      return tx.appointment.findUniqueOrThrow({ where: { id }, include: { doctor: true, patient: true, service: true, notes: { orderBy: { createdAt: "desc" } } } });
    }, { timeout: 15000 });

    let notificationSent = false;
    try {
      notificationSent = await notifyDoctorOnTelegram({
        chatId: targetDoctor.telegramChatId || "", appointmentId: id, doctorName: targetDoctor.name,
        patientName: updatedAppointment.patientName, patientPhone: updatedAppointment.patientPhone,
        serviceName: updatedAppointment.service.name, appointmentDate: updatedAppointment.appointmentDate,
        startTime: updatedAppointment.startTime, chiefComplaint: updatedAppointment.chiefComplaint,
      });
    } catch { console.error("Transferred appointment notification failed"); }

    return NextResponse.json({
      success: true,
      notificationSent,
      data: updatedAppointment,
      message: `Өвчтөний цагийг ${targetDoctor.name} эмч рүү амжилттай шилжүүллээ.`,
    });
  } catch (error) {
    return apiError(error);
  }
}
