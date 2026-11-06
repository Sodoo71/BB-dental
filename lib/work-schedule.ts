export type WorkInterval = { startTime: string; endTime: string };
export type WorkException = WorkInterval & { kind?: string; status?: string };
export const leaveKindNames: Record<string, string> = {
  DAY_OFF: "Бүтэн өдрийн чөлөө",
  BLOCKED_RANGE: "Цагийн чөлөө",
  SCHEDULE_OVERRIDE: "Тухайн өдрийн ажиллах цаг",
};
export const leaveStatusNames: Record<string, string> = {
  PENDING: "Батлахыг хүлээж байна",
  APPROVED: "Баталсан",
  REJECTED: "Татгалзсан",
};

// Approval is the only point at which an exception changes bookable hours.
export function workIntervals(
  weekly: WorkInterval | null | undefined,
  exceptions: WorkException[],
): WorkInterval[] {
  const approved = exceptions.filter(
    (e) => !e.status || e.status === "APPROVED",
  );
  if (approved.some((e) => e.kind === "DAY_OFF")) return [];
  const overrides = approved.filter((e) => e.kind === "SCHEDULE_OVERRIDE");
  // Creation rejects multiple approved overrides for the same doctor/date.
  const base = overrides[0] || weekly;
  if (!base) return [];
  let intervals = [{ startTime: base.startTime, endTime: base.endTime }];
  for (const block of approved.filter((e) => e.kind !== "SCHEDULE_OVERRIDE")) {
    intervals = intervals.flatMap((i) =>
      block.endTime <= i.startTime || block.startTime >= i.endTime
        ? [i]
        : [
            ...(block.startTime > i.startTime
              ? [{ startTime: i.startTime, endTime: block.startTime }]
              : []),
            ...(block.endTime < i.endTime
              ? [{ startTime: block.endTime, endTime: i.endTime }]
              : []),
          ],
    );
  }
  return intervals;
}

export function coversAppointment(
  intervals: WorkInterval[],
  appointment: WorkInterval,
) {
  return intervals.some(
    (i) =>
      i.startTime <= appointment.startTime && i.endTime >= appointment.endTime,
  );
}
