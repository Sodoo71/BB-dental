import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { canChangeAppointment } from "@/lib/doctor-workspace";
import { apiError, HttpError } from "@/lib/security/http";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("DOCTOR");
    if (!user?.doctorId) throw new HttpError(403, "Эмчийн эрх шаардлагатай.");
    const { id } = await params;
    const { status } = z.object({ status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]) }).parse(await request.json());
    const updated = await prisma.$transaction(async tx => {
      const current = await tx.appointment.findFirst({ where: { id, doctorId: user.doctorId } });
      if (!current) throw new HttpError(404, "Захиалга олдсонгүй.");
      if (!canChangeAppointment(current.status, status)) throw new HttpError(409, "Энэ төлөвт шилжүүлэх боломжгүй. Жагсаалтаа шинэчилнэ үү.");
      const changed = await tx.appointment.updateMany({ where: { id, doctorId: user.doctorId, status: current.status }, data: { status } });
      if (!changed.count) throw new HttpError(409, "Захиалга өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү.");
      await tx.auditLog.create({ data: { actorId: user.id, action: "APPOINTMENT_UPDATED", entity: "Appointment", entityId: id, metadata: { previousStatus: current.status, status } } });
      return tx.appointment.findUniqueOrThrow({ where: { id } });
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) { return apiError(error); }
}
