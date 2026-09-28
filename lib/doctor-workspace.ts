export const appointmentLabels = { PENDING: "Хүлээгдэж буй", CONFIRMED: "Баталгаажсан", COMPLETED: "Дууссан", CANCELLED: "Цуцлагдсан", NO_SHOW: "Ирээгүй" };
export type AppointmentState = keyof typeof appointmentLabels;
export function canChangeAppointment(from: AppointmentState, to: AppointmentState) {
  return (from === "PENDING" && ["CONFIRMED", "CANCELLED"].includes(to)) || (from === "CONFIRMED" && ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(to));
}
export function clinicDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function clinicMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ulaanbaatar", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now).split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}
export function appointmentPatient<T extends { patient: { fullName: string; phone: string } | null; patientName: string; patientPhone: string }>(appointment: T) {
  return { ...appointment, patient: appointment.patient || { fullName: appointment.patientName, phone: appointment.patientPhone } };
}
