import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPastSlot, minutesToTime, toMinutes, withinRange } from "@/lib/availability";
import { resolveDaySchedule } from "@/lib/availability-slots";
import { clinicDateKey } from "@/lib/doctor-workspace";
import { apiError } from "@/lib/security/http";

const weekdays = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const doctorId = params.get("doctorId");
    const serviceId = params.get("serviceId");
    const start = new Date(`${clinicDateKey()}T00:00:00Z`);
    const end = new Date(start.getTime() + 31 * 86400000);
    const [service, doctors] = await Promise.all([
      prisma.service.findFirst({ where: { isActive: true, ...(serviceId ? { id: serviceId } : {}) }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true, durationMin: true } }),
      prisma.doctor.findMany({ where: { isActive: true, ...(doctorId ? { id: doctorId } : {}) }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true } }),
    ]);
    if (!service || !doctors.length || service.durationMin <= 0) return NextResponse.json({ success: true, data: [], earliest: null });
    const doctorIds = doctors.map(doctor => doctor.id);
    // A fixed five queries for the complete scan, independent of days and doctor count.
    const [weekly, exceptions, appointments] = await Promise.all([
      prisma.doctorSchedule.findMany({ where: { doctorId: { in: doctorIds } } }),
      prisma.doctorAvailabilityException.findMany({ where: { doctorId: { in: doctorIds }, isActive: true, date: { gte: start, lt: end } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.appointment.findMany({ where: { doctorId: { in: doctorIds }, status: { not: "CANCELLED" }, appointmentDate: { gte: start, lt: end } }, select: { doctorId: true, appointmentDate: true, startTime: true, endTime: true } }),
    ]);
    const suggestions = [];
    for (let offset = 0; offset < 31 && suggestions.length < 6; offset++) {
      const date = new Date(start.getTime() + offset * 86400000);
      const dateKey = date.toISOString().slice(0, 10);
      for (const doctor of doctors) {
        const schedule = resolveDaySchedule(
          weekly.find(row => row.doctorId === doctor.id && row.dayOfWeek === date.getUTCDay()) ?? null,
          exceptions.filter(row => row.doctorId === doctor.id && row.date.toISOString().slice(0, 10) === dateKey),
        );
        if (schedule.isDayOff || !schedule.startTime || !schedule.endTime) continue;
        const occupied = appointments.filter(row => row.doctorId === doctor.id && row.appointmentDate.toISOString().slice(0, 10) === dateKey);
        for (let minute = toMinutes(schedule.startTime); minute + service.durationMin <= toMinutes(schedule.endTime) && suggestions.length < 6; minute += service.durationMin) {
          const slot = minutesToTime(minute);
          const slotEnd = minutesToTime(minute + service.durationMin);
          if (isPastSlot(date, slot) || [...occupied, ...schedule.blockedRanges].some(range => withinRange(range.startTime, range.endTime, slot, slotEnd))) continue;
          suggestions.push({ date: dateKey, formattedDate: `${date.getUTCMonth() + 1}-р сарын ${date.getUTCDate()} (${weekdays[date.getUTCDay()]})`, dayOfWeek: weekdays[date.getUTCDay()], slot, doctorId: doctor.id, doctorName: doctor.name, serviceId: service.id, serviceName: service.name });
        }
        if (suggestions.length >= 6) break;
      }
    }
    return NextResponse.json({ success: true, data: suggestions, earliest: suggestions[0] ?? null });
  } catch (error) { return apiError(error); }
}
