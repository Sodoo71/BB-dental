import { createHash } from "node:crypto";
import { telegramConfig, telegramCall, type TelegramConfig } from "./telegram";
import { db } from "./db";
import { Prisma } from "@/app/generated/prisma/client";
import { ApiError } from "./http";
import { clock, minutes, overlaps, today, nowTime } from "./domain";
import { z } from "zod";
import { dateSchema, timeSchema, phoneSchema } from "./domain";
export const bookingSchema = z.object({
  patientId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  doctorId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: dateSchema,
  startTime: timeSchema,
  note: z.string().max(2000).default(""),
  repeatOfId: z.string().uuid().optional(),
});
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
    !schedule ||
    date < today() ||
    (service.doctorIds.length > 0 && !service.doctorIds.includes(doctorId))
  )
    return [];
  const result: string[] = [];
  for (
    let start = minutes(schedule.startTime);
    start + service.duration <= minutes(schedule.endTime);
    start += 15
  ) {
    const s = clock(start),
      e = clock(start + service.duration);
    if (date === today() && s <= nowTime()) continue;
    if (
      [...leaves, ...appointments].some((a) =>
        overlaps(s, e, a.startTime, a.endTime),
      )
    )
      continue;
    result.push(s);
  }
  return result;
}
export async function createBooking(
  data: z.infer<typeof bookingSchema>,
  actorId?: string,
) {
  const result = await db.$transaction(async (tx) => {
    await doctorLock(tx, data.doctorId);
    const slots = await availability(
      data.doctorId,
      data.serviceId,
      data.date,
      tx,
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
    } else
      patient = await tx.patient.upsert({
        where: { phone: data.phone },
        create: { name: data.name, phone: data.phone },
        update: {},
      });
    if (!patient.active)
      throw new ApiError(400, "Өвчтөний бүртгэл идэвхгүй байна.");
    if (data.repeatOfId) {
      const previous = await tx.appointment.findUnique({
        where: { id: data.repeatOfId },
      });
      if (!previous || previous.patientId !== patient.id)
        throw new ApiError(400, "Давтан захиалгын өвчтөн зөрж байна.");
    }
    return tx.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: data.doctorId,
        serviceId: data.serviceId,
        date: data.date,
        startTime: data.startTime,
        endTime: clock(minutes(data.startTime) + service.duration),
        note: data.note,
        repeatOfId: data.repeatOfId,
        createdById: actorId,
        status: actorId ? "CONFIRMED" : "PENDING",
      },
      include: { doctor: true, service: true, patient: true },
    });
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
}) {
  const day = new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Ulaanbaatar",
  }).format(new Date(`${a.date}T12:00:00+08:00`));
  return `🦷 ШИНЭ ЦАГИЙН ЗАХИАЛГА\n👨‍⚕️ Эмч: ${a.doctor.name}\n👤 Үйлчлүүлэгч: ${a.patient.name}\n📞 Утас: ${a.patient.phone}\n🩺 Үйлчилгээ: ${a.service.name}\n📅 Өдөр: ${day}\n⏰ Цаг: ${a.startTime}\nДоорх товчоор шууд баталгаажуулах эсвэл цуцлах боломжтой:`;
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
