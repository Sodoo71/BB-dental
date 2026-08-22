import { prisma } from "@/lib/prisma";

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
  const nowUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (appointmentDate.getTime() < nowUTC.getTime()) return true;
  if (appointmentDate.getTime() > nowUTC.getTime()) return false;
  return toMinutes(time) <= now.getUTCHours() * 60 + now.getUTCMinutes();
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

export async function getDoctorDaySchedule(doctorId: string, date: Date) {
  const dayStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const weekly = await prisma.doctorSchedule.findUnique({
    where: { doctorId_dayOfWeek: { doctorId, dayOfWeek: date.getUTCDay() } },
  });

  let startTime = weekly?.startTime ?? null;
  let endTime = weekly?.endTime ?? null;
  let isDayOff = Boolean(weekly?.isDayOff);

  const exceptions = await prisma.doctorAvailabilityException.findMany({
    where: {
      doctorId,
      isActive: true,
      date: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const entry of exceptions) {
    if (entry.type === "DAY_OFF") {
      isDayOff = true;
      startTime = null;
      endTime = null;
      continue;
    }
    if (
      entry.type === "SCHEDULE_OVERRIDE" &&
      entry.startTime &&
      entry.endTime
    ) {
      startTime = entry.startTime;
      endTime = entry.endTime;
      isDayOff = false;
      continue;
    }
    if (entry.type === "BLOCKED_RANGE") {
      // handled separately
    }
  }

  return {
    startTime,
    endTime,
    isDayOff,
    blockedRanges: exceptions
      .filter(
        (entry) =>
          entry.type === "BLOCKED_RANGE" && entry.startTime && entry.endTime,
      )
      .map((entry) => ({
        startTime: entry.startTime as string,
        endTime: entry.endTime as string,
        reason: entry.reason,
      })),
    overrides: exceptions,
  };
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
}: {
  doctorId: string;
  serviceId: string;
  date: Date;
}) {
  const doctor = await prisma.doctor.findFirst({
    where: { id: doctorId, isActive: true },
    select: { id: true },
  });
  if (!doctor) return [];

  const service = await prisma.service.findFirst({
    where: { id: serviceId, isActive: true },
    select: { durationMin: true },
  });
  if (!service) return [];

  const durationMin = getServiceDurationMinutes(service.durationMin);
  if (durationMin <= 0) return [];

  const daySchedule = await getDoctorDaySchedule(doctorId, date);
  if (!daySchedule.startTime || !daySchedule.endTime || daySchedule.isDayOff)
    return [];

  const from = toMinutes(daySchedule.startTime);
  const to = toMinutes(daySchedule.endTime);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return [];

  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      appointmentDate: { gte: date, lt: nextDay },
      status: { notIn: ["CANCELLED"] },
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
}: {
  doctorId: string;
  serviceId: string;
  appointmentDate: Date;
  startTime: string;
}) {
  const slots = await generateAvailableSlots({
    doctorId,
    serviceId,
    date: appointmentDate,
  });
  if (!slots.includes(startTime)) {
    throw new Error("The selected time is no longer available.");
  }
}
