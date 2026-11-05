import type { AppointmentStatus } from "@/app/generated/prisma/client";

const transitions: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  CANCELLED: ["PENDING", "CONFIRMED"],
  COMPLETED: [],
  NO_SHOW: [],
};

export function mayChangeAppointment(from: AppointmentStatus, to: AppointmentStatus) {
  return from === to || transitions[from].includes(to);
}

export function appointmentLockKey(doctorId: string, date: Date) {
  return `${doctorId}:${date.toISOString().slice(0, 10)}`;
}
