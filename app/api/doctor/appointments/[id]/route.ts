import { NextResponse } from "next/server";
import { AppointmentStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole("DOCTOR");
  if (!user || !user.doctorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { status } = await request.json();

    if (
      !Object.values(AppointmentStatus).includes(status as AppointmentStatus)
    ) {
      return NextResponse.json(
        { error: "Invalid appointment status." },
        { status: 400 },
      );
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, doctorId: true },
    });

    if (!appointment || appointment.doctorId !== user.doctorId) {
      return NextResponse.json(
        { error: "Appointment not found." },
        { status: 404 },
      );
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: status as AppointmentStatus },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update appointment.",
      },
      { status: 500 },
    );
  }
}
