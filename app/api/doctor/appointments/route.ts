import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await requireRole("DOCTOR");
  if (!user || !user.doctorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "30");
  const status = searchParams.get("status") || undefined;
  const startDate = searchParams.get("date") || undefined;

  const now = new Date();
  const toDate = new Date(now);
  toDate.setDate(
    toDate.getDate() + (Number.isFinite(days) && days > 0 ? days : 30),
  );

  const where: Record<string, unknown> = {
    doctorId: user.doctorId,
    appointmentDate: {
      gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      lte: toDate,
    },
  };

  if (status) where.status = status;
  if (startDate) {
    const date = new Date(`${startDate}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      const nextDay = new Date(date);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      where.appointmentDate = { gte: date, lt: nextDay };
    }
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: { patient: true, service: true },
    orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ success: true, data: appointments });
}
