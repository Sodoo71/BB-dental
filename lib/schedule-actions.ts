import { z } from "zod";
import { db } from "./db";
import { doctorLock } from "./booking";
import { ApiError } from "./http";
import { timeSchema, today } from "./domain";
import { leaveSchema } from "./validation";
import {
  ensureSingleOverride,
  ensureWorkCoverage,
} from "./work-schedule-server";

export const weekSchema = z
  .object({
    doctorId: z.string().uuid(),
    days: z
      .array(
        z
          .object({
            weekday: z.number().int().min(0).max(6),
            off: z.boolean(),
            startTime: timeSchema,
            endTime: timeSchema,
          })
          .refine(
            (d) => d.off || d.startTime < d.endTime,
            "Эхлэх цаг дуусах цагаас өмнө байна.",
          ),
      )
      .length(7),
  })
  .refine(
    (v) => new Set(v.days.map((d) => d.weekday)).size === 7,
    "Долоон гараг тус бүрийг нэг удаа оруулна уу.",
  );

export async function saveWeek(
  data: z.infer<typeof weekSchema>,
  actorId: string,
) {
  return db.$transaction(async (tx) => {
    await doctorLock(tx, data.doctorId);
    await tx.doctor.findUniqueOrThrow({ where: { id: data.doctorId } });
    for (const day of data.days) {
      const where = { doctorId: data.doctorId, weekday: day.weekday };
      if (day.off) await tx.schedule.deleteMany({ where });
      else
        await tx.schedule.upsert({
          where: { doctorId_weekday: where },
          create: { ...where, startTime: day.startTime, endTime: day.endTime },
          update: { startTime: day.startTime, endTime: day.endTime },
        });
    }
    await ensureWorkCoverage(tx, data.doctorId);
    await tx.auditLog.create({
      data: {
        actorId,
        action: "UPDATE_WEEK_SCHEDULE",
        entity: "doctors",
        entityId: data.doctorId,
      },
    });
    return { ok: true };
  });
}

export async function saveLeave(
  input: unknown,
  actor: { id: string; role: string; doctor?: { id: string } | null },
  id?: string,
) {
  const parsed = leaveSchema.parse(input);
  const data =
    parsed.kind === "DAY_OFF"
      ? { ...parsed, startTime: "00:00", endTime: "23:59" }
      : parsed;
  if (
    actor.role !== "ADMIN" &&
    (actor.role !== "DOCTOR" || actor.doctor?.id !== data.doctorId)
  )
    throw new ApiError(403, "Зөвхөн өөрийн чөлөөний хүсэлт илгээнэ.");
  if (data.date < today())
    throw new ApiError(400, "Өнгөрсөн өдөрт хүсэлт оруулах боломжгүй.");
  return db.$transaction(async (tx) => {
    await doctorLock(tx, data.doctorId);
    const previous = id
      ? await tx.leave.findUniqueOrThrow({ where: { id } })
      : null;
    if (previous && previous.doctorId !== data.doctorId)
      throw new ApiError(400, "Эмчийг солих боломжгүй.");
    if (previous?.status === "APPROVED" && actor.role !== "ADMIN")
      throw new ApiError(403, "Батлагдсан чөлөөг админ өөрчилнө.");
    if (data.kind === "SCHEDULE_OVERRIDE")
      await ensureSingleOverride(tx, data.doctorId, data.date, id);
    const saved = previous
      ? await tx.leave.update({
          where: { id },
          data: { ...data, status: "APPROVED" },
        })
      : await tx.leave.create({ data: { ...data, status: "APPROVED" } });
    await ensureWorkCoverage(tx, data.doctorId, [
      data.date,
      ...(previous ? [previous.date] : []),
    ]);
    const result = await tx.leave.update({
      where: { id: saved.id },
      data: {
        status: actor.role === "ADMIN" ? "APPROVED" : "PENDING",
        reviewedById: actor.role === "ADMIN" ? actor.id : null,
        reviewedAt: actor.role === "ADMIN" ? new Date() : null,
      },
    });
    return result;
  });
}

export async function reviewLeave(
  id: string,
  status: "APPROVED" | "REJECTED",
  actorId: string,
) {
  return db.$transaction(async (tx) => {
    const found = await tx.leave.findUniqueOrThrow({ where: { id } });
    await doctorLock(tx, found.doctorId);
    const current = await tx.leave.findUniqueOrThrow({ where: { id } });
    if (current.status !== "PENDING")
      throw new ApiError(409, "Энэ хүсэлтийг аль хэдийн шийдвэрлэсэн байна.");
    if (current.date < today())
      throw new ApiError(409, "Хүсэлтийн өдөр өнгөрсөн байна.");
    if (status === "APPROVED" && current.kind === "SCHEDULE_OVERRIDE")
      await ensureSingleOverride(tx, current.doctorId, current.date, id);
    const result = await tx.leave.update({
      where: { id },
      data: { status, reviewedById: actorId, reviewedAt: new Date() },
    });
    await ensureWorkCoverage(tx, current.doctorId, [current.date]);
    await tx.auditLog.create({
      data: {
        actorId,
        action: `LEAVE_${status}`,
        entity: "leaves",
        entityId: id,
      },
    });
    return result;
  });
}
