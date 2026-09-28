import { doctorProfileSchema } from "@/lib/validation/doctor";
import { apiError } from "@/lib/security/http";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const user = await requireRole("ADMIN", "SUPER_ADMIN", "RECEPTION");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  try {
    const doctors = await prisma.doctor.findMany({
      include: { schedules: { orderBy: { dayOfWeek: "asc" } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: doctors });
  } catch (error) {
    console.error("GET /api/admin/doctors error:", error);
    return NextResponse.json(
      { error: "Эмчийн мэдээлэл авахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  try {
    const input = doctorProfileSchema.parse(await request.json());
    if (!input.name) {
      return NextResponse.json(
        { error: "Эмчийн нэр заавал байна." },
        { status: 400 },
      );
    }
    const doctor = await prisma.$transaction(async tx => {
      const created = await tx.doctor.create({ data: { ...input, specialty: input.specialty || "Шүдний их эмч", imageUrl: input.avatarUrl } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "DOCTOR_CREATED", entity: "Doctor", entityId: created.id } });
      return created;
    });
    return NextResponse.json({ success: true, data: doctor }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
