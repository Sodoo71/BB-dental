export type DoctorLeaveType = "DAY_OFF" | "BLOCKED_RANGE" | "SCHEDULE_OVERRIDE";

type AppointmentRange = { startTime: string; endTime: string };

export function hasDoctorLeaveConflict(
  type: DoctorLeaveType,
  startTime: string | null,
  endTime: string | null,
  appointments: AppointmentRange[],
) {
  return appointments.some((appointment) => {
    if (type === "DAY_OFF") return true;
    if (!startTime || !endTime) return false;
    if (type === "BLOCKED_RANGE") {
      return appointment.startTime < endTime && appointment.endTime > startTime;
    }
    return appointment.startTime < startTime || appointment.endTime > endTime;
  });
}
