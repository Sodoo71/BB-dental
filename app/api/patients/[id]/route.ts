import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiError, HttpError } from "@/lib/security/http";
import { patientSchema, patientPageSchema } from "@/lib/validation/patient";
import { receptionAppointmentSelect } from "@/lib/appointments/dto";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("ADMIN", "RECEPTION", "DOCTOR");
    if (!user || (user.role === "DOCTOR" && !user.doctorId)) throw new HttpError(403, "Хандах эрхгүй байна.");
    const { id } = await params;
    const page = patientPageSchema.parse(new URL(request.url).searchParams.get("page") ?? 1);
    const patient = await prisma.patient.findFirst({ where: { id, ...(user.role === "DOCTOR" ? { appointments: { some: { doctorId: user.doctorId } } } : {}) } });
    if (!patient) throw new HttpError(404, "Үйлчлүүлэгч олдсонгүй.");
    if (new URL(request.url).searchParams.get("summary") === "true") return NextResponse.json({ success: true, data: patient });
    const where = { patientId: id, ...(user.role === "DOCTOR" ? { doctorId: user.doctorId! } : {}) };
    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({ where, select: user.role === "RECEPTION" ? receptionAppointmentSelect : {
        ...receptionAppointmentSelect, chiefComplaint: true, note: true,
        notes: { orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 50 },
      }, orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }, { id: "asc" }], take: 50, skip: (page - 1) * 50 }),
      prisma.appointment.count({ where }),
    ]);
    return NextResponse.json({ success: true, data: { ...patient, appointments }, pagination: { page, pageSize: 50, total } });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("ADMIN", "RECEPTION");
    if (!user) throw new HttpError(403, "Хандах эрхгүй байна.");
    const { id } = await params;
    const input = patientSchema.partial().parse(await request.json());
    if (!Object.keys(input).length) throw new HttpError(400, "Өөрчлөх мэдээллээ оруулна уу.");
    const patient = await prisma.$transaction(async tx => {
      const existing = await tx.patient.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new HttpError(404, "Үйлчлүүлэгч олдсонгүй.");
      const updated = await tx.patient.update({ where: { id }, data: input });
      await tx.auditLog.create({ data: { actorId: user.id, action: "PATIENT_UPDATED", entity: "Patient", entityId: id, metadata: { fields: Object.keys(input) } } });
      return updated;
    });
    return NextResponse.json({ success: true, data: patient });
  } catch (error) { return apiError(error); }
}
