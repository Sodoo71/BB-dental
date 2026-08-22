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
  };
}

export async function GET() {
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
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
    const input = readDoctorInput((await request.json()) as DoctorInput);
    if (!input.name) {
      return NextResponse.json(
        { error: "Эмчийн нэр заавал байна." },
        { status: 400 },
      );
    }
    const doctor = await prisma.doctor.create({ data: input });
    return NextResponse.json({ success: true, data: doctor }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/doctors error:", error);
    return NextResponse.json(
      { error: "Эмч нэмэхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}
