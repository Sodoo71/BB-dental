export type WeeklySchedule = { startTime: string; endTime: string; isDayOff: boolean; isActive: boolean };
export type ScheduleException = { type: string; reason?: string | null; startTime: string | null; endTime: string | null };

export function resolveDaySchedule(weekly: WeeklySchedule | null, exceptions: ScheduleException[]) {
  let startTime = weekly?.startTime ?? null;
  let endTime = weekly?.endTime ?? null;
  let isDayOff = Boolean(weekly?.isDayOff || weekly?.isActive === false);
  for (const entry of exceptions) {
    if (entry.type === "DAY_OFF") { isDayOff = true; startTime = null; endTime = null; }
    if (entry.type === "SCHEDULE_OVERRIDE" && entry.startTime && entry.endTime) {
      startTime = entry.startTime; endTime = entry.endTime; isDayOff = false;
    }
  }
  return { startTime, endTime, isDayOff, blockedRanges: exceptions.filter(
    (entry): entry is ScheduleException & { startTime: string; endTime: string } =>
      entry.type === "BLOCKED_RANGE" && Boolean(entry.startTime && entry.endTime),
  ) };
}
