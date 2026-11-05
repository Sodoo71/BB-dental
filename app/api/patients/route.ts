import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiError, HttpError } from "@/lib/security/http";
import { patientSchema, patientPageSchema } from "@/lib/validation/patient";
import type { Prisma } from "@/app/generated/prisma/client";

export async function GET(request: Request) {
  try {
    const user = await requireRole("ADMIN", "SUPER_ADMIN", "RECEPTION", "DOCTOR");
    if (!user || (user.role === "DOCTOR" && !user.doctorId)) throw new HttpError(403, "Хандах эрхгүй байна.");
    const params = new URL(request.url).searchParams;
    const page = patientPageSchema.parse(params.get("page") ?? 1);
    const search = (params.get("search") ?? "").trim().slice(0, 120);
    const where: Prisma.PatientWhereInput = {
      ...(user.role === "DOCTOR" ? { appointments: { some: { doctorId: user.doctorId } } } : {}),
      ...(search ? { OR: [{ fullName: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.patient.findMany({ where, select: { id: true, fullName: true, phone: true, email: true, age: true, gender: true, createdAt: true }, orderBy: [{ fullName: "asc" }, { id: "asc" }], take: 50, skip: (page - 1) * 50 }),
      prisma.patient.count({ where }),
    ]);
    return NextResponse.json({ success: true, data, pagination: { page, pageSize: 50, total } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole("ADMIN", "SUPER_ADMIN", "RECEPTION");
    if (!user) throw new HttpError(403, "Хандах эрхгүй байна.");
    const input = patientSchema.parse(await request.json());
    const patient = await prisma.$transaction(async tx => {
      const created = await tx.patient.create({ data: input });
      await tx.auditLog.create({ data: { actorId: user.id, action: "PATIENT_CREATED", entity: "Patient", entityId: created.id } });
      return created;
    });
    return NextResponse.json({ success: true, data: patient }, { status: 201 });
  } catch (error) { return apiError(error); }
}
