import { prisma } from "@/lib/prisma";
import { getDoctorDaySchedule, isPastSlot, toMinutes, withinRange } from "@/lib/availability";
import { HttpError } from "@/lib/security/http";
import { appointmentLockKey, mayChangeAppointment } from "./policy";
import type { AppointmentStatus, Prisma } from "@/app/generated/prisma/client";

export async function lockAppointmentDay(tx: Prisma.TransactionClient, doctorId: string, date: Date) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${appointmentLockKey(doctorId, date)}))::text`;
}

export async function changeAppointmentStatus(
  actor: { id: string; role: string }, id: string, status: AppointmentStatus,
) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.appointment.findUnique({ where: { id } });
    if (!current) throw new HttpError(404, "Захиалга олдсонгүй.");
    if (!mayChangeAppointment(current.status, status)) throw new HttpError(409, "Энэ төлөвт шилжүүлэх боломжгүй.");
    if (current.status === status) return current;
    if (current.doctorId) await lockAppointmentDay(tx, current.doctorId, current.appointmentDate);
    if (current.status === "CANCELLED") {
      if (!current.doctorId) throw new HttpError(409, "Эмч сонгож дахин цаг захиална уу.");
      // Interactive transactions share one pg connection; issue its queries sequentially.
      const doctor = await tx.doctor.findUnique({ where: { id: current.doctorId }, select: { isActive: true } });
      const service = await tx.service.findUnique({ where: { id: current.serviceId }, select: { isActive: true } });
      const schedule = await getDoctorDaySchedule(current.doctorId, current.appointmentDate, tx);
      if (!doctor?.isActive || !service?.isActive || isPastSlot(current.appointmentDate, current.startTime) ||
          schedule.isDayOff || !schedule.startTime || !schedule.endTime ||
          current.startTime < schedule.startTime || current.endTime > schedule.endTime ||
          toMinutes(current.endTime) <= toMinutes(current.startTime) ||
          schedule.blockedRanges.some(range => withinRange(range.startTime, range.endTime, current.startTime, current.endTime))) {
        throw new HttpError(409, "Энэ цаг боломжгүй болсон байна. Дахин цаг сонгоно уу.");
      }
      const dayStart = new Date(current.appointmentDate);
      dayStart.setUTCHours(0, 0, 0, 0);
      const collision = await tx.appointment.findFirst({ where: {
        id: { not: id }, doctorId: current.doctorId,
        appointmentDate: { gte: dayStart, lt: new Date(dayStart.getTime() + 86400000) },
        status: { not: "CANCELLED" }, startTime: { lt: current.endTime }, endTime: { gt: current.startTime },
      }, select: { id: true } });
      if (collision) throw new HttpError(409, "Сонгосон цаг аль хэдийн захиалагдсан байна.");
    }
    const result = await tx.appointment.updateMany({
      where: { id, status: current.status, doctorId: current.doctorId }, data: { status },
    });
    if (!result.count) throw new HttpError(409, "Захиалга өөрчлөгдсөн байна. Дахин ачаална уу.");
    await tx.auditLog.create({ data: {
      actorId: actor.id, action: "APPOINTMENT_UPDATED", entity: "Appointment", entityId: id,
      metadata: { previousStatus: current.status, status },
    } });
    return tx.appointment.findUniqueOrThrow({ where: { id } });
  }, { timeout: 15000 });
}
