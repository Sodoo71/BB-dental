import { clock, minutes, overlaps } from "./domain";
import type { WorkInterval } from "./work-schedule";

export function availableTimes(
  date: string,
  duration: number,
  intervals: WorkInterval[],
  occupied: WorkInterval[],
  current: { date: string; time: string },
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
  return [...new Set(times)].sort();
}
