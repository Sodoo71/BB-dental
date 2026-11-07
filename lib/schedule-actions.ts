import { z } from "zod";
import { db } from "./db";
import { doctorLock } from "./booking";
import { ApiError } from "./http";
import { timeSchema, today } from "./domain";
import { leaveSchema } from "./validation";
import type { Prisma } from "@/app/generated/prisma/client";
import { schedulePolicy, scheduleLockDays } from "./schedule-policy";
import {
  ensureSingleOverride,
  ensureWorkCoverage,
} from "./work-schedule-server";

type ScheduleActor = {
  id: string;
  role: string;
  doctor?: { id: string } | null;
};

export async function ensureScheduleEditable(
  tx: Prisma.TransactionClient,
  date: string,
  actor: ScheduleActor,
) {
  if (date < today())
    throw new ApiError(403, "Өнгөрсөн өдрийн хуваарийг өөрчлөх боломжгүй.");
  if (actor.role === "ADMIN") return;
  const setting = await tx.setting.findUnique({
    where: { key: "scheduleLockDays" },
  });
  const policy = schedulePolicy(scheduleLockDays(setting?.value), today());
  if (date < policy.editableFrom)
    throw new ApiError(
      403,
      `${policy.protectedThrough} хүртэлх хуваарь хамгаалагдсан. ${policy.editableFrom}-ээс хойших хуваарийг өөрчилнө үү.`,
    );
}

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
  actor: ScheduleActor,
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
    if (previous) {
      await ensureScheduleEditable(tx, previous.date, actor);
      await ensureScheduleEditable(tx, data.date, actor);
      if (actor.role === "DOCTOR" && previous.date !== data.date)
        throw new ApiError(400, "Өдрийг шилжүүлэхдээ шинэ хүсэлт үүсгэнэ үү.");
      if (
        previous.status === "APPROVED" &&
        !["SCHEDULE_OVERRIDE", "DAY_OFF"].includes(previous.kind) &&
        actor.role !== "ADMIN"
      )
        throw new ApiError(403, "Батлагдсан чөлөөг админ өөрчилнө.");
    }
    const official = await tx.leave.findFirst({
      where: {
        doctorId: data.doctorId,
        date: data.date,
        kind: { in: ["SCHEDULE_OVERRIDE", "DAY_OFF"] },
        status: "APPROVED",
      },
    });
    const weekly = await tx.schedule.findUnique({
      where: {
        doctorId_weekday: {
          doctorId: data.doctorId,
          weekday: new Date(`${data.date}T12:00:00Z`).getUTCDay(),
        },
      },
    });
    if (actor.role === "DOCTOR" && (official || weekly))
      await ensureScheduleEditable(tx, data.date, actor);
    const replacesId =
      actor.role === "DOCTOR"
        ? previous?.status === "APPROVED"
          ? previous.id
          : previous?.replacesId ||
            (["SCHEDULE_OVERRIDE", "DAY_OFF"].includes(data.kind)
              ? official?.id
              : null)
        : previous?.replacesId;
    const updateId =
      previous && (actor.role === "ADMIN" || previous.status !== "APPROVED")
        ? previous.id
        : undefined;
    if (data.kind === "SCHEDULE_OVERRIDE" || data.kind === "DAY_OFF") {
      const pending = await tx.leave.findFirst({
        where: {
          doctorId: data.doctorId,
          date: data.date,
          status: "PENDING",
          kind: { in: ["SCHEDULE_OVERRIDE", "DAY_OFF"] },
          ...(updateId ? { id: { not: updateId } } : {}),
        },
      });
      if (pending)
        throw new ApiError(
          409,
          "Энэ өдөр хүлээгдэж буй хүсэлт байна. Одоо байгаа хүсэлтээ засах эсвэл цуцална уу.",
        );
    }
    if (actor.role === "ADMIN" && data.kind === "SCHEDULE_OVERRIDE")
      await ensureSingleOverride(tx, data.doctorId, data.date, id);
    const values = {
      ...data,
      replacesId: replacesId || null,
      status: actor.role === "ADMIN" ? "APPROVED" : "PENDING",
      reviewedById: actor.role === "ADMIN" ? actor.id : null,
      reviewedAt: actor.role === "ADMIN" ? new Date() : null,
    };
    const saved = updateId
      ? await tx.leave.update({ where: { id: updateId }, data: values })
      : await tx.leave.create({ data: values });
    if (actor.role === "ADMIN")
      await ensureWorkCoverage(tx, data.doctorId, [
        data.date,
        ...(previous ? [previous.date] : []),
      ]);
    return saved;
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
    if (status === "APPROVED" && current.replacesId) {
      const original = await tx.leave.findUnique({
        where: { id: current.replacesId },
      });
      if (
        !original ||
        original.status !== "APPROVED" ||
        original.doctorId !== current.doctorId ||
        original.date !== current.date
      )
        throw new ApiError(
          409,
          "Анхны хуваарь өөрчлөгдсөн байна. Хүсэлтээ дахин оруулна уу.",
        );
      await tx.leave.delete({ where: { id: original.id } });
    }
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

export async function removeLeave(id: string, actor: ScheduleActor) {
  return db.$transaction(async (tx) => {
    const found = await tx.leave.findUniqueOrThrow({ where: { id } });
    if (
      actor.role !== "ADMIN" &&
      (actor.role !== "DOCTOR" || actor.doctor?.id !== found.doctorId)
    )
      throw new ApiError(403, "Зөвхөн өөрийн хуваарийг өөрчилнө.");
    await doctorLock(tx, found.doctorId);
    const current = await tx.leave.findUniqueOrThrow({ where: { id } });
    await ensureScheduleEditable(tx, current.date, actor);
    if (actor.role === "DOCTOR" && current.status === "APPROVED") {
      if (current.kind !== "SCHEDULE_OVERRIDE")
        throw new ApiError(403, "Батлагдсан чөлөөг админ цуцална.");
      if (
        await tx.leave.count({
          where: {
            doctorId: current.doctorId,
            date: current.date,
            status: "PENDING",
            kind: { in: ["SCHEDULE_OVERRIDE", "DAY_OFF"] },
          },
        })
      )
        throw new ApiError(
          409,
          "Энэ өдрийн хүсэлт аль хэдийн хүлээгдэж байна.",
        );
      return tx.leave.create({
        data: {
          doctorId: current.doctorId,
          date: current.date,
          kind: "DAY_OFF",
          startTime: "00:00",
          endTime: "23:59",
          reason: "Ажиллах хуваарь цуцлах хүсэлт",
          status: "PENDING",
          replacesId: current.id,
        },
      });
    }
    await tx.leave.delete({ where: { id } });
    if (current.status === "APPROVED" && current.kind === "SCHEDULE_OVERRIDE")
      await tx.leave.create({
        data: {
          doctorId: current.doctorId,
          date: current.date,
          kind: "DAY_OFF",
          reason: "Ажиллах хуваарь цуцалсан",
          status: "APPROVED",
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });
    await ensureWorkCoverage(tx, current.doctorId, [current.date]);
    return { ok: true };
  });
}
