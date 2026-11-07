import type { BookingContactPlan } from "./booking-contact-session";
import {
  bookingContactFields,
  bookingContactSchema,
  validateGuardian,
} from "./patient-demographics";
import { createHash } from "node:crypto";
import { telegramConfig, telegramCall, type TelegramConfig } from "./telegram";
import { db } from "./db";
import { Prisma } from "@/app/generated/prisma/client";
import { ApiError } from "./http";
import { clock, minutes, today, nowTime } from "./domain";
import { z } from "zod";
import { dateSchema, timeSchema } from "./domain";
import { workIntervals } from "./work-schedule";
import { availableTimes } from "./available-times";
export const bookingSchema = z.object({
  patientId: z.string().uuid().optional(),
  ...bookingContactFields,
  doctorId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: dateSchema,
  startTime: timeSchema,
  note: z.string().max(2000).default(""),
  repeatOfId: z.string().uuid().optional(),
});
export const staffBookingSchema = bookingSchema.extend({
  force: z.boolean().default(false),
});
export const publicBookingSchema = bookingSchema
  .omit({ patientId: true, repeatOfId: true })
  .extend({ rememberContact: z.boolean().default(false) })
  .superRefine(validateGuardian);
export async function doctorLock(
  tx: Prisma.TransactionClient,
  doctorId: string,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${doctorId}))::text AS locked`;
}
export async function availability(
  doctorId: string,
  serviceId: string,
  date: string,
  client: Prisma.TransactionClient = db,
  excludeId?: string,
  requestedTime?: string,
  allowScheduleOverride = false,
) {
  // A transaction owns one pg connection; issue its statements sequentially.
  const doctor = await client.doctor.findUnique({ where: { id: doctorId } });
  const service = await client.service.findUnique({ where: { id: serviceId } });
  const schedule = await client.schedule.findUnique({
    where: {
      doctorId_weekday: {
        doctorId,
        weekday: new Date(`${date}T12:00:00Z`).getUTCDay(),
      },
    },
  });
  const leaves = await client.leave.findMany({ where: { doctorId, date } });
  const appointments = await client.appointment.findMany({
    where: {
      doctorId,
      date,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { startTime: true, endTime: true },
  });
  if (
    !doctor?.active ||
    !service?.active ||
    date < today() ||
    (service.doctorIds.length > 0 && !service.doctorIds.includes(doctorId))
  )
    return [];
  return availableTimes(
    date,
    service.duration,
    // Explicit, server-authorized staff bookings may override working/leave
    // intervals. Active doctor/service, future time, duration and conflicts
    // remain validated by the same slot engine under the doctor lock.
    allowScheduleOverride
      ? [{ startTime: "00:00", endTime: "23:59" }]
      : workIntervals(schedule, leaves),
    appointments,
    { date: today(), time: nowTime() },
    requestedTime,
  );
}

export async function createBooking(
  data: z.infer<typeof bookingSchema>,
  actorId?: string,
  contactSession?: BookingContactPlan,
  options: { allowScheduleOverride?: boolean } = {},
) {
  const contact = bookingContactSchema.parse(data);
  const result = await db.$transaction(async (tx) => {
    await doctorLock(tx, data.doctorId);
    const slots = await availability(
      data.doctorId,
      data.serviceId,
      data.date,
      tx,
      undefined,
      actorId ? data.startTime : undefined,
      Boolean(actorId && options.allowScheduleOverride),
    );
    // Every booking is checked again while holding the doctor lock.
    const service = await tx.service.findUniqueOrThrow({
      where: { id: data.serviceId },
    });
    if (!slots.includes(data.startTime))
      throw new ApiError(409, "Сонгосон цаг боломжгүй эсвэл давхардсан байна.");
    let patient;
    if (data.patientId) {
      patient = await tx.patient.findUnique({ where: { id: data.patientId } });
      if (!patient?.active) throw new ApiError(404, "Өвчтөн олдсонгүй.");
    } else {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`patient:${contact.phone}`}))::text AS locked`;
      const existing = await tx.patient.findUnique({
        where: { phone: data.phone },
      });
      const normalizedName = (name: string) =>
        name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
      if (
        !actorId &&
        existing &&
        (normalizedName(existing.name) !== normalizedName(contact.name) ||
          (existing.birthDate &&
            contact.birthDate &&
            existing.birthDate !== contact.birthDate))
      )
        throw new ApiError(
          409,
          "Нэр, төрсөн огноо бүртгэлтэй мэдээлэлтэй зөрж байна. Өөр өвчтөний дугаараар бүртгүүлэхгүйгээр эмнэлэгтэй холбогдоно уу.",
        );
      patient = await tx.patient.upsert({
        where: { phone: data.phone },
        create: contact,
        update: {},
      });
    }
    if (!patient.active)
      throw new ApiError(400, "Өвчтөний бүртгэл идэвхгүй байна.");
    if (data.repeatOfId) {
      const previous = await tx.appointment.findUnique({
        where: { id: data.repeatOfId },
      });
      if (!previous || previous.patientId !== patient.id)
        throw new ApiError(400, "Давтан захиалгын өвчтөн зөрж байна.");
    }
    const details = bookingContactSchema.parse({
      ...contact,
      birthDate: contact.birthDate || patient.birthDate,
      gender: contact.gender || patient.gender,
      guardianName: contact.guardianName || patient.guardianName,
      guardianPhone: contact.guardianPhone || patient.guardianPhone,
    });
    const doctor = await tx.doctor.findUniqueOrThrow({
      where: { id: data.doctorId },
    });
    let bookingContactId: string | undefined;
    if (contactSession) {
      const { id, ...values } = contactSession;
      const session = id
        ? await tx.bookingContactSession.update({ where: { id }, data: values })
        : await tx.bookingContactSession.create({ data: values });
      bookingContactId = session.id;
    }
    const appointment = await tx.appointment.create({
      data: {
        bookingContactId,
        patientId: patient.id,
        doctorId: data.doctorId,
        serviceId: data.serviceId,
        date: data.date,
        startTime: data.startTime,
        endTime: clock(minutes(data.startTime) + service.duration),
        note: data.note,
        contactName: contact.name,
        birthDate: details.birthDate,
        gender: details.gender,
        guardianName: details.guardianName,
        guardianPhone: details.guardianPhone,
        repeatOfId: data.repeatOfId,
        createdById: actorId,
        status: actorId ? "CONFIRMED" : "PENDING",
      },
    });
    if (actorId && options.allowScheduleOverride) {
      await tx.auditLog.create({
        data: {
          actorId,
          action: "APPOINTMENT_SCHEDULE_OVERRIDE",
          entity: "appointments",
          entityId: appointment.id,
        },
      });
    }
    return { ...appointment, doctor, service, patient };
  });
  await notifyBooking(result);
  return result;
}
export async function notifyDoctor(
  chatId: string,
  text: string,
  send: typeof fetch = fetch,
  event: "booking" | "transfer" | "recovery" | "test" = "booking",
  override?: TelegramConfig,
  replyMarkup?: Record<string, unknown>,
) {
  let config: TelegramConfig;
  try {
    config = override || (await telegramConfig());
  } catch {
    return { ok: false, code: "FAILED" } as const;
  }
  if (!config.token || !chatId)
    return { ok: false, code: "NOT_CONFIGURED" } as const;
  if (event !== "test" && !config[event])
    return { ok: false, code: "DISABLED" } as const;
  try {
    await telegramCall(
      "sendMessage",
      {
        chat_id: chatId,
        text,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      },
      config,
      send,
    );
    return { ok: true, code: "SENT" } as const;
  } catch {
    console.error("Telegram notification unavailable");
    return { ok: false, code: "FAILED" } as const;
  }
}

export function bookingMessage(a: {
  date: string;
  startTime: string;
  doctor: { name: string };
  patient: { name: string; phone: string };
  service: { name: string };
  contactName?: string;
}) {
  const day = new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Ulaanbaatar",
  }).format(new Date(`${a.date}T12:00:00+08:00`));
  return `🦷 ШИНЭ ЦАГИЙН ЗАХИАЛГА\n👨‍⚕️ Эмч: ${a.doctor.name}\n👤 Үйлчлүүлэгч: ${a.contactName || a.patient.name}\n📞 Утас: ${a.patient.phone}\n🩺 Үйлчилгээ: ${a.service.name}\n📅 Өдөр: ${day}\n⏰ Цаг: ${a.startTime}\nДоорх товчоор шууд баталгаажуулах эсвэл цуцлах боломжтой:`;
}
export function bookingActionTag(a: {
  date: string;
  startTime: string;
  doctorId: string;
  serviceId: string;
}) {
  return createHash("sha256")
    .update([a.date, a.startTime, a.doctorId, a.serviceId].join("|"))
    .digest("hex")
    .slice(0, 8);
}
export async function notifyBooking(
  a: Parameters<typeof bookingMessage>[0] & {
    id: string;
    doctorId: string;
    serviceId: string;
    doctor: { name: string; telegramChatId: string };
  },
) {
  return notifyDoctor(
    a.doctor.telegramChatId,
    bookingMessage(a),
    undefined,
    "booking",
    undefined,
    {
      inline_keyboard: [
        [
          {
            text: "✅ Баталгаажуулах",
            callback_data: `appt:confirm:${a.id}:${bookingActionTag(a)}`,
          },
          {
            text: "❌ Цуцлах",
            callback_data: `appt:cancel:${a.id}:${bookingActionTag(a)}`,
          },
        ],
      ],
    },
  );
}
