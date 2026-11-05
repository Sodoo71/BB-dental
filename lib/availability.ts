import { resolveDaySchedule } from "@/lib/availability-slots";
import { clinicDateKey, clinicMinutes } from "@/lib/doctor-workspace";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { HttpError } from "@/lib/security/http";

type AvailabilityDatabase = Pick<Prisma.TransactionClient, "doctor" | "service" | "doctorSchedule" | "doctorAvailabilityException" | "appointment">;

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseDateInput(value: string | null): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? parsed
    : null;
}

export function toMinutes(value: string): number {
  const match = value.match(timePattern);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(value: number): string {
  const total = Math.max(0, value);
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function dateOnlyKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function toUTCDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function isPastSlot(
  date: Date,
  time: string,
  now = new Date(),
): boolean {
  const appointmentDate = toUTCDateOnly(date);
  const nowUTC = new Date(`${clinicDateKey(now)}T00:00:00Z`);
  if (appointmentDate.getTime() < nowUTC.getTime()) return true;
  if (appointmentDate.getTime() > nowUTC.getTime()) return false;
  return toMinutes(time) <= clinicMinutes(now);
}

export function withinRange(
  start: string,
  end: string,
  candidateStart: string,
  candidateEnd: string,
) {
  const aStart = toMinutes(start);
  const aEnd = toMinutes(end);
  const cStart = toMinutes(candidateStart);
  const cEnd = toMinutes(candidateEnd);
  return cStart < aEnd && cEnd > aStart;
}

export async function getDoctorDaySchedule(doctorId: string, date: Date, db: AvailabilityDatabase = prisma) {
  const dayStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const weekly = await db.doctorSchedule.findUnique({
    where: { doctorId_dayOfWeek: { doctorId, dayOfWeek: date.getUTCDay() } },
  });

  const exceptions = await db.doctorAvailabilityException.findMany({
    where: {
      doctorId,
      isActive: true,
      date: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { createdAt: "asc" },
  });

  return { ...resolveDaySchedule(weekly, exceptions), overrides: exceptions };
}

export function getServiceDurationMinutes(
  value: string | number | null | undefined,
): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return 0;
}

export async function generateAvailableSlots({
  doctorId,
  serviceId,
  date,
  db = prisma,
  excludeAppointmentId,
}: {
  doctorId: string;
  serviceId: string;
  date: Date;
  db?: AvailabilityDatabase;
  excludeAppointmentId?: string;
}) {
  const doctor = await db.doctor.findFirst({
    where: { id: doctorId, isActive: true },
    select: { id: true },
  });
  if (!doctor) return [];

  const service = await db.service.findFirst({
    where: { id: serviceId, isActive: true },
    select: { durationMin: true },
  });
  if (!service) return [];

  const durationMin = getServiceDurationMinutes(service.durationMin);
  if (durationMin <= 0) return [];

  const daySchedule = await getDoctorDaySchedule(doctorId, date, db);
  if (!daySchedule.startTime || !daySchedule.endTime || daySchedule.isDayOff)
    return [];

  const from = toMinutes(daySchedule.startTime);
  const to = toMinutes(daySchedule.endTime);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return [];

  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const appointments = await db.appointment.findMany({
    where: {
      doctorId,
      appointmentDate: { gte: date, lt: nextDay },
      status: { notIn: ["CANCELLED"] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: { startTime: true, endTime: true },
  });

  const blockedRanges = [...(daySchedule.blockedRanges ?? [])];
  const slots: string[] = [];

  for (
    let current = from;
    current + durationMin <= to;
    current += durationMin
  ) {
    const startTime = minutesToTime(current);
    const endTime = minutesToTime(current + durationMin);

    if (isPastSlot(date, startTime)) continue;

    const overlapsExistingAppointment = appointments.some((appointment) => {
      const appointmentStart = toMinutes(appointment.startTime);
      const appointmentEnd = toMinutes(appointment.endTime);
      return (
        appointmentStart < appointmentEnd &&
        current < appointmentEnd &&
        current + durationMin > appointmentStart
      );
    });
    if (overlapsExistingAppointment) continue;

    const overlapsBlockedRange = blockedRanges.some((range) =>
      withinRange(range.startTime, range.endTime, startTime, endTime),
    );
    if (overlapsBlockedRange) continue;

    slots.push(startTime);
  }

  return slots;
}

export async function findNextAvailableSlot({
  doctorId,
  serviceId,
  fromDate = new Date(),
}: {
  doctorId: string;
  serviceId: string;
  fromDate?: Date;
}) {
  const cursor = toUTCDateOnly(fromDate);
  for (let offset = 0; offset <= 120; offset += 1) {
    const candidateDate = new Date(cursor);
    candidateDate.setUTCDate(candidateDate.getUTCDate() + offset);
    const slots = await generateAvailableSlots({
      doctorId,
      serviceId,
      date: candidateDate,
    });
    if (slots.length > 0) {
      return {
        date: candidateDate,
        slot: slots[0],
      };
    }
  }

  return null;
}

export async function ensureAppointmentSlotIsAvailable({
  doctorId,
  serviceId,
  appointmentDate,
  startTime,
  db,
  excludeAppointmentId,
}: {
  doctorId: string;
  serviceId: string;
  appointmentDate: Date;
  startTime: string;
  db?: AvailabilityDatabase;
  excludeAppointmentId?: string;
}) {
  const slots = await generateAvailableSlots({
    doctorId,
    serviceId,
    date: appointmentDate,
    db,
    excludeAppointmentId,
  });
  if (!slots.includes(startTime)) {
    throw new HttpError(409, "The selected time is no longer available.");
  }
}
