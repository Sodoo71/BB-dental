import { doctorProfileSchema } from "@/lib/validation/doctor";
import { apiError, HttpError } from "@/lib/security/http";
import { lockUserAdministration } from "@/lib/auth/users";
import { mayManageUser } from "@/lib/permissions/policy";
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
    await prisma.$transaction(async tx => {
      await lockUserAdministration(tx, user);
      const linked = await tx.user.findUnique({ where: { doctorId: id } });
      if (linked && !mayManageUser(user, linked)) throw new HttpError(403, "Энэ хэрэглэгчийн эрхийг өөрчлөх боломжгүй.");
      if (linked) {
        await tx.user.update({ where: { id: linked.id }, data: { isActive: false, status: "SUSPENDED" } });
        await tx.session.deleteMany({ where: { userId: linked.id } });
      }
      await tx.doctor.update({ where: { id }, data: { isActive: false } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "DOCTOR_ARCHIVED", entity: "Doctor", entityId: id } });
    });
    return NextResponse.json({ success: true, message: "Эмч идэвхгүй боллоо. Захиалгын түүх хадгалагдсан." });
  } catch (error) {
    return apiError(error);
  }
}
