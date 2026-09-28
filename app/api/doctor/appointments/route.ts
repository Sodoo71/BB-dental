import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { parseDateInput } from "@/lib/availability";
import { appointmentPatient, clinicDateKey } from "@/lib/doctor-workspace";
import { apiError, HttpError } from "@/lib/security/http";
export async function GET(request: Request) {
  try {
    const user = await requireRole("DOCTOR");
    if (!user?.doctorId) throw new HttpError(403, "Эмчийн эрх шаардлагатай.");
    const params = new URL(request.url).searchParams;
    let start = new Date(`${clinicDateKey()}T00:00:00Z`);
    let end = new Date(start);
    if (params.has("year") && params.has("month")) {
      const year = z.coerce.number().int().min(2000).max(2200).parse(params.get("year"));
      const month = z.coerce.number().int().min(0).max(11).parse(params.get("month"));
      start = new Date(Date.UTC(year, month, 1)); end = new Date(Date.UTC(year, month + 1, 1));
    } else if (params.get("date")) {
      const date = parseDateInput(params.get("date"));
      if (!date) throw new HttpError(400, "Огноогоо шалгана уу.");
      start = date; end = new Date(start.getTime() + 86400000);
    } else {
      const days = z.coerce.number().int().min(1).max(365).parse(params.get("days") ?? 90);
      start = new Date(start.getTime() - 60 * 86400000); end = new Date(end.getTime() + days * 86400000);
    }
    const status = params.get("status");
    const parsedStatus = status && status !== "ALL" ? z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).parse(status) : undefined;
    const appointments = await prisma.appointment.findMany({ where: { doctorId: user.doctorId, appointmentDate: { gte: start, lt: end }, ...(parsedStatus ? { status: parsedStatus } : {}) }, include: { patient: true, service: true }, orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }] });
    return NextResponse.json({ success: true, data: appointments.map(appointmentPatient) });
  } catch (error) { return apiError(error); }
}
