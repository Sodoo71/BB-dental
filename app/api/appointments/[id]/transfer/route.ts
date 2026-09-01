import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";

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
    const targetDoctorId = typeof body.targetDoctorId === "string" ? body.targetDoctorId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!targetDoctorId) {
      return NextResponse.json(
        { error: "Шилжүүлэх эмчийг сонгоно уу." },
        { status: 400 },
      );
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true, patient: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Захиалга олдсонгүй." }, { status: 404 });
    }

    const targetDoctor = await prisma.doctor.findUnique({
      where: { id: targetDoctorId },
    });

    if (!targetDoctor) {
      return NextResponse.json({ error: "Шилжүүлэх эмч олдсонгүй." }, { status: 404 });
    }

    const prevDoctorName = appointment.doctor?.name || "Тодорхойгүй эмч";
    const authorName = user.name || (user.role === "DOCTOR" ? "Эмч" : "Ресепшн");

    const noteText = `Шилжүүлэг: ${prevDoctorName} -> ${targetDoctor.name}.${reason ? ` Шалтгаан: ${reason}` : ""}`;

    const [updatedAppointment] = await prisma.$transaction([
      prisma.appointment.update({
        where: { id },
        data: {
          doctorId: targetDoctorId,
        },
        include: {
          doctor: true,
          patient: true,
          service: true,
          notes: { orderBy: { createdAt: "desc" } },
        },
      }),
      prisma.appointmentNote.create({
        data: {
          appointmentId: id,
          note: noteText,
          author: authorName,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: updatedAppointment,
      message: `Өвчтөний цагийг ${targetDoctor.name} эмч рүү амжилттай шилжүүллээ.`,
    });
  } catch (error) {
    console.error("POST /api/appointments/[id]/transfer error:", error);
    return NextResponse.json(
      { error: "Өвчтөн шилжүүлэхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}
