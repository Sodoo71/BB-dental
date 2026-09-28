import { doctorProfileSchema } from "@/lib/validation/doctor";
import { apiError } from "@/lib/security/http";
import { NextResponse } from "next/server";
import { updateDoctorProfile } from "@/lib/auth/users";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const { id } = await context.params;
  try {
    const input = doctorProfileSchema.parse(await request.json());
    if (!input.name)
      return NextResponse.json(
        { error: "Эмчийн нэр заавал байна." },
        { status: 400 },
      );
    const doctor = await updateDoctorProfile(user, id, input);
    return NextResponse.json({ success: true, data: doctor });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!doctor)
      return NextResponse.json({ error: "Эмч олдсонгүй." }, { status: 404 });
    await prisma.doctor.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/doctors/[id] error:", error);
    return NextResponse.json(
      {
        error: "Энэ эмч захиалгатай тул устгах боломжгүй. Идэвхгүй болгоно уу.",
      },
      { status: 409 },
    );
  }
}
