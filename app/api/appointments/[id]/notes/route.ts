import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай." }, { status: 401 });
  }

  const { id } = await props.params;

  try {
    const notes = await prisma.appointmentNote.findMany({
      where: { appointmentId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: notes });
  } catch (error) {
    console.error("GET /api/appointments/[id]/notes error:", error);
    return NextResponse.json(
      { error: "Тэмдэглэл татахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (!user || !["DOCTOR", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Эрх хүрэлцэхгүй байна." }, { status: 403 });
  }

  const { id } = await props.params;

  try {
    const body = await request.json();
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (!note) {
      return NextResponse.json(
        { error: "Тэмдэглэлийн текст оруулна уу." },
        { status: 400 },
      );
    }

    const author = user.name || (user.role === "DOCTOR" ? "Эмч" : "Ресепшн");

    const createdNote = await prisma.appointmentNote.create({
      data: {
        appointmentId: id,
        note,
        author,
      },
    });

    return NextResponse.json({ success: true, data: createdNote }, { status: 201 });
  } catch (error) {
    console.error("POST /api/appointments/[id]/notes error:", error);
    return NextResponse.json(
      { error: "Тэмдэглэл хадгалахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}
