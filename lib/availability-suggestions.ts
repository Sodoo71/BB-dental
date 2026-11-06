import { db } from "./db";
import { ApiError } from "./http";
import { today, nowTime } from "./domain";
import { availableTimes } from "./available-times";
import { workIntervals } from "./work-schedule";

export async function earliestAvailability(
  serviceId: string,
  doctorId?: string,
  from = today(),
) {
  if (from < today())
    throw new ApiError(400, "Өнөөдрөөс хойших өдөр сонгоно уу.");
  const until = new Date(Date.parse(`${from}T12:00:00Z`) + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const service = await db.service.findUnique({
    where: { id: serviceId, active: true },
  });
  if (!service) throw new ApiError(404, "Үйлчилгээ олдсонгүй.");
  const doctors = await db.doctor.findMany({
    where: {
      active: true,
      ...(doctorId ? { id: doctorId } : {}),
      ...(service.doctorIds.length
        ? { AND: { id: { in: service.doctorIds } } }
        : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const ids = doctors.map((d) => d.id);
  const [schedules, leaves, appointments] = await Promise.all([
    db.schedule.findMany({ where: { doctorId: { in: ids } } }),
    db.leave.findMany({
      where: {
        doctorId: { in: ids },
        status: "APPROVED",
        date: { gte: from, lte: until },
      },
    }),
    db.appointment.findMany({
      where: {
        doctorId: { in: ids },
        date: { gte: from, lte: until },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { doctorId: true, date: true, startTime: true, endTime: true },
    }),
  ]);
  const result: {
    date: string;
    startTime: string;
    doctorId: string;
    doctorName: string;
  }[] = [];
  const current = { date: today(), time: nowTime() };
  for (let offset = 0; offset < 31; offset++) {
    const date = new Date(Date.parse(`${from}T12:00:00Z`) + offset * 86400000)
      .toISOString()
      .slice(0, 10);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const day = doctors
      .flatMap((doctor) => {
        const work = workIntervals(
          schedules.find(
            (s) => s.doctorId === doctor.id && s.weekday === weekday,
          ),
          leaves.filter((l) => l.doctorId === doctor.id && l.date === date),
        );
        return availableTimes(
          date,
          service.duration,
          work,
          appointments.filter(
            (a) => a.doctorId === doctor.id && a.date === date,
          ),
          current,
        )
          .slice(0, 6)
          .map((startTime) => ({
            date,
            startTime,
            doctorId: doctor.id,
            doctorName: doctor.name,
          }));
      })
      .sort(
        (a, b) =>
          a.startTime.localeCompare(b.startTime) ||
          a.doctorName.localeCompare(b.doctorName),
      );
    result.push(...day.slice(0, 6 - result.length));
    if (result.length >= 6) break;
  }
  return result;
}
