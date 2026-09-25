import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";
import { apiError, HttpError } from "@/lib/security/http";
async function authorizedAppointment(id: string) {
  const user = await requireSessionUser();
  if (!user || !["DOCTOR", "ADMIN", "SUPER_ADMIN"].includes(user.role)) throw new HttpError(403, "Эрх хүрэлцэхгүй байна.");
  const appointment = await prisma.appointment.findFirst({ where: { id, ...(user.role === "DOCTOR" ? { doctorId: user.doctorId ?? "" } : {}) }, select: { id: true } });
  if (!appointment) throw new HttpError(404, "Захиалга олдсонгүй.");
  return user;
}
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    await authorizedAppointment(id);
    const page = z.coerce.number().int().min(1).max(100000).parse(new URL(request.url).searchParams.get("page") ?? 1);
    const notes = await prisma.appointmentNote.findMany({ where: { appointmentId: id }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 50, skip: (page - 1) * 50 });
    return NextResponse.json({ success: true, data: notes });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const user = await authorizedAppointment(id);
    const { note } = z.object({ note: z.string().trim().min(1).max(10000) }).parse(await request.json());
    const created = await prisma.$transaction(async (tx) => {
      const result = await tx.appointmentNote.create({ data: { appointmentId: id, note, author: user.name } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "APPOINTMENT_NOTE_ADDED", entity: "Appointment", entityId: id } });
      return result;
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) { return apiError(error); }
}
