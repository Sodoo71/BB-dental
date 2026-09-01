import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await requireRole("DOCTOR");
  if (!user || !user.doctorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "90");
  const status = searchParams.get("status") || undefined;
  const startDate = searchParams.get("date") || undefined;
  const monthParam = searchParams.get("month"); // 0-11 or 1-12
  const yearParam = searchParams.get("year");

  let dateFilter: Record<string, unknown> = {};

  if (yearParam && monthParam !== null) {
    const year = Number(yearParam);
    const month = Number(monthParam);
    const mStart = new Date(Date.UTC(year, month, 1));
    const mEnd = new Date(Date.UTC(year, month + 1, 1));
    dateFilter = { gte: mStart, lt: mEnd };
  } else if (startDate) {
    const date = new Date(`${startDate}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      const nextDay = new Date(date);
      nextDay.setUTCDate(date.getUTCDate() + 1);
      dateFilter = { gte: date, lt: nextDay };
    }
  } else {
    const now = new Date();
    const pastStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const futureEnd = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
    dateFilter = { gte: pastStart, lte: futureEnd };
  }

  const where: Record<string, unknown> = {
    doctorId: user.doctorId,
    appointmentDate: dateFilter,
  };

  if (status) where.status = status;

  const appointments = await prisma.appointment.findMany({
    where,
    include: { patient: true, service: true },
    orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ success: true, data: appointments });
}
