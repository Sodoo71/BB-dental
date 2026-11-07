import { clock, minutes, overlaps } from "./domain";
import type { WorkInterval } from "./work-schedule";

export function availableTimes(
  date: string,
  duration: number,
  intervals: WorkInterval[],
  occupied: WorkInterval[],
  current: { date: string; time: string },
  requestedTime?: string,
) {
  if (date < current.date || !Number.isInteger(duration) || duration <= 0)
    return [];
  const times: string[] = [];
  for (const interval of intervals) {
    for (
      let m = minutes(interval.startTime);
      m + duration <= minutes(interval.endTime);
      m += 15
    ) {
      const startTime = clock(m),
        endTime = clock(m + duration);
      if (date === current.date && startTime <= current.time) continue;
      if (
        !occupied.some((a) =>
          overlaps(startTime, endTime, a.startTime, a.endTime),
        )
      )
        times.push(startTime);
    }
  }
  // Staff phone bookings may start between suggested 15-minute slots.
  // They still need to fit one working interval and avoid every occupied range.
  if (requestedTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(requestedTime)) {
    const endTime = clock(minutes(requestedTime) + duration);
    if (
      (date !== current.date || requestedTime > current.time) &&
      intervals.some(
        (i) => requestedTime >= i.startTime && endTime <= i.endTime,
      ) &&
      !occupied.some((a) =>
        overlaps(requestedTime, endTime, a.startTime, a.endTime),
      )
    )
      times.push(requestedTime);
  }
  return [...new Set(times)].sort();
}
