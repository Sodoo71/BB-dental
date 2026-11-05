import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { apiError } from "@/lib/security/http";
import { changeAppointmentStatus } from "@/lib/appointments/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("ADMIN", "SUPER_ADMIN", "RECEPTION");
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const { status } = z.object({ status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]) }).parse(await request.json());
    const { id } = await params;
    const appointment = await changeAppointmentStatus(user, id, status);
    const { id: appointmentId, appointmentDate, startTime, endTime, status: nextStatus } = appointment;
    return NextResponse.json({ success: true, data: { id: appointmentId, appointmentDate, startTime, endTime, status: nextStatus } });
  } catch (error) { return apiError(error); }
}

// Legacy DELETE now cancels; appointment history and notes remain accessible.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("ADMIN", "SUPER_ADMIN", "RECEPTION");
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const { id } = await params;
    await changeAppointmentStatus(user, id, "CANCELLED");
    return NextResponse.json({ success: true, message: "Захиалга цуцлагдлаа. Түүх хадгалагдсан." });
  } catch (error) { return apiError(error); }
}
