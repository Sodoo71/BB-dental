import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

type DoctorInput = Record<string, unknown>;

function readDoctorInput(input: DoctorInput) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const optionalString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    name,
    title: optionalString(input.title),
    phone: optionalString(input.phone),
    email: optionalString(input.email),
    avatarUrl: optionalString(input.avatarUrl),
    telegramChatId: optionalString(input.telegramChatId),
    isActive: typeof input.isActive === "boolean" ? input.isActive : true,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const { id } = await context.params;
  try {
    const input = readDoctorInput((await request.json()) as DoctorInput);
    if (!input.name)
      return NextResponse.json(
        { error: "Эмчийн нэр заавал байна." },
        { status: 400 },
      );
    const doctor = await prisma.doctor.update({ where: { id }, data: input });
    return NextResponse.json({ success: true, data: doctor });
  } catch (error) {
    console.error("PATCH /api/admin/doctors/[id] error:", error);
    return NextResponse.json(
      { error: "Эмчийн мэдээлэл шинэчлэхэд алдаа гарлаа." },
      { status: 500 },
    );
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
